const { MemoryStore } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redisClient, isRedisReady } = require("../config/redis.config");

/**
 * ResilientRateLimitStore:
 * Automatically uses RedisStore when Redis is ready, and transparently
 * falls back to in-memory MemoryStore if Redis is offline or restarting.
 */
class ResilientRateLimitStore {
  constructor(prefix = "rl") {
    this.prefix = prefix;
    this.memoryStore = new MemoryStore();
    this.redisStore = null;

    const setupRedisStore = () => {
      try {
        this.redisStore = new RedisStore({
          sendCommand: (...args) => redisClient.call(...args),
          prefix: `rl:${this.prefix}:`,
        });
        if (this.options && typeof this.redisStore.init === "function") {
          this.redisStore.init(this.options);
        }
      } catch (err) {
        this.redisStore = null;
      }
    };

    if (isRedisReady()) {
      setupRedisStore();
    }

    redisClient.on("ready", () => {
      setupRedisStore();
    });

    redisClient.on("close", () => {
      this.redisStore = null;
    });

    redisClient.on("error", () => {
      this.redisStore = null;
    });
  }

  init(options) {
    this.options = options;
    this.memoryStore.init(options);
    if (this.redisStore && typeof this.redisStore.init === "function") {
      try {
        this.redisStore.init(options);
      } catch (err) {
        // fail-open
      }
    }
  }

  async increment(key) {
    if (this.redisStore && isRedisReady()) {
      try {
        return await this.redisStore.increment(key);
      } catch (err) {
        return this.memoryStore.increment(key);
      }
    }
    return this.memoryStore.increment(key);
  }

  async decrement(key) {
    if (this.redisStore && isRedisReady()) {
      try {
        return await this.redisStore.decrement(key);
      } catch (err) {
        return this.memoryStore.decrement(key);
      }
    }
    return this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    if (this.redisStore && isRedisReady()) {
      try {
        await this.redisStore.resetKey(key);
      } catch (err) {
        // ignore
      }
    }
    return this.memoryStore.resetKey(key);
  }

  async resetAll() {
    if (this.redisStore && isRedisReady()) {
      try {
        await this.redisStore.resetAll();
      } catch (err) {
        // ignore
      }
    }
    return this.memoryStore.resetAll();
  }
}

function createRateLimitStore(prefix) {
  return new ResilientRateLimitStore(prefix);
}

module.exports = {
  ResilientRateLimitStore,
  createRateLimitStore,
};
