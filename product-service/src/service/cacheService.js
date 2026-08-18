import redisClient from "../config/redis.js";

const DEFAULT_TTL = 300; // 5 minutes

const cacheService = {
    /**
     * Get a cached value. Returns parsed object or null if cache miss.
     */
    async get(key) {
        try {
            const data = await redisClient.get(key);
            if (!data) return null;
            console.log(`🟢 Cache HIT: ${key}`);
            return JSON.parse(data);
        } catch (err) {
            console.error(`Redis GET error for key "${key}":`, err);
            return null; // fallback to DB on cache errors
        }
    },

    /**
     * Set a cached value with optional TTL (in seconds).
     */
    async set(key, value, ttl = DEFAULT_TTL) {
        try {
            await redisClient.setEx(key, ttl, JSON.stringify(value));
            console.log(`🔵 Cache SET: ${key} (TTL: ${ttl}s)`);
        } catch (err) {
            console.error(`Redis SET error for key "${key}":`, err);
        }
    },

    /**
     * Delete one or more cache keys (for invalidation on mutations).
     */
    async del(...keys) {
        try {
            await redisClient.del(keys);
            console.log(`🔴 Cache INVALIDATED: ${keys.join(", ")}`);
        } catch (err) {
            console.error(`Redis DEL error for keys "${keys.join(", ")}":`, err);
        }
    },
};

export default cacheService;
