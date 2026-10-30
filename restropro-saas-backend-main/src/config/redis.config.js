const Redis = require("ioredis");
const { CONFIG } = require("./index");

let isReady = false;
let hasLoggedError = false;

const redisOptions = {
  host: CONFIG.REDIS_HOST || "127.0.0.1",
  port: Number(CONFIG.REDIS_PORT) || 6379,
  password: CONFIG.REDIS_PASSWORD || undefined,
  enableOfflineQueue: false, // Fail fast so caller can immediately fallback to MySQL
  maxRetriesPerRequest: 1,   // No hanging requests if Redis is unresponsive
  connectTimeout: 4000,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
};

const redisClient = new Redis(redisOptions);

redisClient.on("connect", () => {
  // Socket connected
});

redisClient.on("ready", () => {
  isReady = true;
  hasLoggedError = false;
  console.log(`[redis] Connected and ready at ${redisOptions.host}:${redisOptionsoptionsPort(redisOptions.port)}`);
});

redisClient.on("error", (err) => {
  isReady = false;
  if (!hasLoggedError) {
    console.warn(`[redis] Connection error (${err.code || err.message}). Operating in fail-open mode (direct MySQL queries).`);
    hasLoggedError = true;
  }
});

redisClient.on("close", () => {
  isReady = false;
});

redisClient.on("reconnecting", () => {
  // Reconnecting in background
});

function redisOptionsoptionsPort(port) {
  return port || 6379;
}

function isRedisReady() {
  return isReady && redisClient.status === "ready";
}

module.exports = {
  redisClient,
  isRedisReady,
};
