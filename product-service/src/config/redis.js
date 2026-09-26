import { createClient } from "redis";

// rediss:// URL already implies TLS — do NOT also set socket.tls or the client throws a mismatch error
const redisClient = createClient({
    url: process.env.REDIS_URL, // rediss:// → TLS is handled automatically by the URL scheme

    // Ping every 10 s to keep the Upstash connection alive
    pingInterval: 10000,

    socket: {
        // TCP keep-alive (ms). tls is omitted here — it's inferred from rediss://
        keepAlive: 10000,
    },
});

redisClient.on("error", (err) => {
    console.error("❌ Redis Client Error:", err);
});

redisClient.on("connect", () => {
    console.log("✅ Connected to Redis (Upstash)");
});

await redisClient.connect();

export default redisClient;