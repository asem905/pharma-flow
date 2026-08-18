import "dotenv/config";
import axios from "axios";
import logger from "./utils/logger.js";

// Config 
const INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS) || 30_000; // 30 s default
const REQUEST_TIMEOUT_MS = 5_000;

// All services to probe. Reads base URLs from env so it works in Docker too.
const SERVICES = [
    { name: "api-gateway", url: process.env.API_GW_URL },
    { name: "auth-service", url: process.env.AUTH_SERVICE_URL },
    { name: "product-service", url: process.env.PRODUCT_SERVICE_URL },
    { name: "order-service", url: process.env.ORDER_SERVICE_URL },
    { name: "payment-service", url: process.env.PAYMENT_SERVICE_URL },
    { name: "notification-service", url: process.env.NOTIFICATION_SERVICE_URL },
    { name: "logging-service", url: process.env.LOGGING_SERVICE_URL },
];

// Core check 
async function checkService(service) {
    const start = Date.now();
    try {
        const res = await axios.get(`${service.url}/health`, {
            timeout: REQUEST_TIMEOUT_MS,
        });
        const latencyMs = Date.now() - start;
        const status = res.status === 200 ? "UP" : "DEGRADED";

        logger.info("Health check passed", {
            service: service.name,
            status,
            httpStatus: res.status,
            latencyMs,
        });

        return { service: service.name, status, latencyMs };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");

        logger.warn("Health check failed", {
            service: service.name,
            status: "DOWN",
            reason: isTimeout ? "timeout" : err.message,
            latencyMs,
        });

        return { service: service.name, status: "DOWN", latencyMs, reason: err.message };
    }
}

// Sweep
async function runHealthChecks() {
    logger.info("Running health check sweep", { services: SERVICES.map(s => s.name) });

    const results = await Promise.allSettled(SERVICES.map(checkService));

    const summary = results.map(r => r.value ?? r.reason);
    const downCount = summary.filter(r => r.status === "DOWN").length;
    const upCount = summary.filter(r => r.status === "UP").length;

    if (downCount > 0) {
        logger.warn("Health sweep complete — some services are DOWN", {
            up: upCount,
            down: downCount,
            downServices: summary.filter(r => r.status === "DOWN").map(r => r.service),
        });
    } else {
        logger.info("Health sweep complete — all services UP", { up: upCount });
    }
}

// Scheduler
logger.info("Health-check service started", {
    intervalMs: INTERVAL_MS,
    services: SERVICES.map(s => s.name),
});

// Run immediately on startup, then on every interval
runHealthChecks();
setInterval(runHealthChecks, INTERVAL_MS);
