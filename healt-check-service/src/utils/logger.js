import winston from 'winston';
import amqplib from 'amqplib';


const EXCHANGE = 'pharmaflow.logs';
const SERVICE = process.env.SERVICE_NAME || 'unknown';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

let channel = null;

(async () => {
    try {
        const conn = await amqplib.connect(RABBITMQ_URL);
        const ch = await conn.createChannel();
        await ch.assertExchange(EXCHANGE, 'fanout', { durable: true });

        ch.on('error', (err) => {
            console.error(`[logger:${SERVICE}] Channel error:`, err.message);
            channel = null; // stop publishing until reconnected
        });
        ch.on('close', () => {
            console.warn(`[logger:${SERVICE}] Channel closed`);
            channel = null;
        });

        channel = ch;
        console.log(`[logger:${SERVICE}] RabbitMQ connected — logs will be shipped to Loki via ${EXCHANGE}`);
    } catch (err) {
        // Logger must never crash the service — just log to console and continue
        console.error(`[logger:${SERVICE}] RabbitMQ connect failed (${RABBITMQ_URL}), logs will be console-only: ${err.message}`);
    }
})();

class RabbitMQTransport extends winston.Transport {
    log(info, callback) {
        if (channel) {
            try {
                const payload = { ...info, service: SERVICE };
                // publish is synchronous (writes to amqplib's internal write buffer)
                const ok = channel.publish(EXCHANGE, '', Buffer.from(JSON.stringify(payload)));
                if (!ok) {
                    // write buffer full — amqplib will drain and resume, messages may be lost
                    console.warn(`[logger:${SERVICE}] Publish buffer full — log entry may be dropped`);
                }
            } catch (err) {
                console.error(`[logger:${SERVICE}] Failed to serialize log payload:`, err.message);
            }
        }
        callback(); // never block Winston's pipeline
    }
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),     // adds { timestamp: '...' } — used by logging-service for Loki ordering
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        // Console: pretty-print in local dev
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                    return `${timestamp} [${level}] ${message}${metaStr}`;
                })
            ),
        }),
        // RabbitMQ: ships logs to the logging-service → Loki
        new RabbitMQTransport(),
    ],
});

export default logger;
