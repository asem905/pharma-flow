import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_URL, // Upstash rediss:// URL
});

redisClient.on("error", (err) => {
    console.error("❌ Redis Client Error:", err);
});

redisClient.on("connect", () => {
    console.log("✅ Connected to Redis (Upstash)");
});

await redisClient.connect();

export default redisClient;
