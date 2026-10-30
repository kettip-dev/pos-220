const { redisClient, isRedisReady } = require("../config/redis.config");

// In-flight promise map for request coalescing (prevents cache stampede / dog-piling)
const inFlightRequests = new Map();

/**
 * Safely parse JSON from Redis
 */
function safeParse(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (err) {
    return null;
  }
}

/**
 * Get cached value from Redis by key
 * Fail-open: returns null if Redis is offline or throws
 */
async function getCache(key) {
  if (!isRedisReady()) return null;
  try {
    const raw = await redisClient.get(key);
    return safeParse(raw);
  } catch (err) {
    return null;
  }
}

/**
 * Set cached value in Redis with TTL in seconds
 * Fail-open: catches and ignores errors
 */
async function setCache(key, value, ttlSeconds = 1800) {
  if (!isRedisReady() || value === undefined) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(key, serialized, "EX", ttlSeconds);
    } else {
      await redisClient.set(key, serialized);
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Delete a specific key via asynchronous UNLINK
 */
async function delCache(key) {
  if (!isRedisReady()) return false;
  try {
    await redisClient.unlink(key);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Coalesced Cache-Aside pattern
 * - Checks Redis cache first
 * - If miss, deduplicates concurrent in-flight executions for identical keys
 * - Calls fetchFn() and saves to Redis asynchronously
 * - Transparently falls back to fetchFn() on any Redis error
 */
async function getOrSetCache(key, ttlSeconds, fetchFn) {
  // If Redis is down, bypass caching directly to DB
  if (!isRedisReady()) {
    return fetchFn();
  }

  // 1. Check existing cache
  try {
    const cached = await getCache(key);
    if (cached !== null) {
      return cached;
    }
  } catch (err) {
    // ignore, fallback to fetchFn
  }

  // 2. Coalesce concurrent requests to prevent cache stampede
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const executionPromise = (async () => {
    try {
      const freshData = await fetchFn();
      if (freshData !== undefined && freshData !== null) {
        setCache(key, freshData, ttlSeconds).catch(() => {});
      }
      return freshData;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, executionPromise);
  return executionPromise;
}

/**
 * Non-blocking cursor-based pattern invalidation using SCAN and UNLINK
 * Safe for production multi-tenant environments (never blocks the event loop)
 */
async function invalidatePattern(pattern) {
  if (!isRedisReady()) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys && keys.length > 0) {
        await redisClient.unlink(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    // Fail-open: do not throw to caller
    console.warn(`[redis] Error invalidating pattern "${pattern}":`, err.message);
  }
}

/**
 * Invalidate all catalog keys for a tenant
 * Keys invalidated: menu items, variants, addons, categories, tables
 */
async function invalidateTenantCatalog(tenantId) {
  if (!tenantId) return;
  await invalidatePattern(`tenant:${tenantId}:catalog:*`);
}

/**
 * Invalidate store settings keys for a tenant
 */
async function invalidateTenantSettings(tenantId) {
  if (!tenantId) return;
  await invalidatePattern(`tenant:${tenantId}:settings:*`);
}

/**
 * Invalidate cached QR code mapping
 */
async function invalidateQRCodeCache(qrcode) {
  if (!qrcode) return;
  await delCache(`qr_code:${qrcode}`);
}

module.exports = {
  getCache,
  setCache,
  delCache,
  getOrSetCache,
  invalidatePattern,
  invalidateTenantCatalog,
  invalidateTenantSettings,
  invalidateQRCodeCache,
};
