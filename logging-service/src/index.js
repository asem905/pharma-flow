import amqp from 'amqplib';
import axios from 'axios';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const LOKI_URL = process.env.LOKI_URL;
const EXCHANGE = process.env.EXCHANGE_NAME;
const QUEUE = `logs-${process.pid}`; // Unique queue to bypass Windows zombie round-robining
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 50;
const FLUSH_INTERVAL_MS = Number(process.env.FLUSH_INTERVAL_MS) || 2000;

// In memory buffer
let buffer = [];
let flushTimer = null;

// ---------------------------------------------------------------------------
// Push a batch of log entries to Loki in a single HTTP call.
// Loki wants entries grouped into "streams" by their label set.
// We group by service + level so each (service, level) pair is its own stream.
// ---------------------------------------------------------------------------
async function pushBatchToLoki(batch) {
    const streamMap = new Map();

    for (const { log, receivedAt } of batch) {
        const service = log.service || 'unknown';
        const level = log.level || 'info';
        const key = `${service}::${level}`;

        if (!streamMap.has(key)) {
            streamMap.set(key, { stream: { service, level }, values: [] });
        }

        // Use the log's own timestamp if present, otherwise the time we received it.
        // Loki requires nanosecond timestamps as strings.
        const ts = log.timestamp
            ? String(new Date(log.timestamp).getTime() * 1_000_000)
            : String(receivedAt * 1_000_000);

        streamMap.get(key).values.push([ts, JSON.stringify(log)]);
    }

    await axios.post(
        `${LOKI_URL}/loki/api/v1/push`,
        { streams: [...streamMap.values()] },
        { headers: { 'Content-Type': 'application/json' } }
    );
}

// Flush the current buffer — send to Loki and ack/nack all messages
async function flush(ch) {
    if (buffer.length === 0) return;

    const batch = buffer.splice(0, buffer.length);
    const count = batch.length;

    try {
        await pushBatchToLoki(batch);

        // Batch-ack: ack the last delivery tag with allUpTo=true
        // → RabbitMQ acks every message up to and including that tag in one frame
        const lastMsg = batch[batch.length - 1].msg;
        ch.ack(lastMsg, true);

        console.log(`[logging-service] ✔ Flushed ${count} log(s) to Loki`);
    } catch (err) {
        console.error(`[logging-service] ✖ Loki push failed (${count} msg) — requeueing:`, err.message);
        // Nack all individually with requeue=true so they'll be retried
        for (const { msg } of batch) {
            ch.nack(msg, false, true);
        }
    }
}

// Reset the periodic flush timer
function scheduleFlush(ch) {
    if (flushTimer) return; // already scheduled
    flushTimer = setTimeout(async () => {
        flushTimer = null;
        await flush(ch);
    }, FLUSH_INTERVAL_MS);
}

// Main
async function start() {
    console.log('[logging-service] Connecting to RabbitMQ…');
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();

    // Fanout exchange — services publish without knowing about the queue
    await ch.assertExchange(EXCHANGE, 'fanout', { durable: true });
    // Exclusive queue: only this process can consume it, auto-deletes on disconnect
    await ch.assertQueue(QUEUE, { exclusive: true });
    await ch.bindQueue(QUEUE, EXCHANGE, '');

    // Allow BATCH_SIZE messages in flight at once so we can fill a full batch
    ch.prefetch(BATCH_SIZE);

    console.log(`[logging-service] Ready — batch=${BATCH_SIZE} flushInterval=${FLUSH_INTERVAL_MS}ms`);
    console.log(`[logging-service] Consuming from queue "${QUEUE}" (exchange: ${EXCHANGE})`);

    ch.consume(QUEUE, async (msg) => {
        if (!msg) return; // consumer cancelled

        let log;
        try {
            log = JSON.parse(msg.content.toString());
            // Quick trace so we know it arrived
            console.log(`[logging-service] Received log from ${log.service}: ${log.message.substring(0, 50)}...`);
        } catch {
            console.error('[logging-service] Malformed JSON — dropping message (no requeue)');
            ch.nack(msg, false, false); // dead-letter malformed messages, never requeue
            return;
        }

        buffer.push({ msg, log, receivedAt: Date.now() });

        // Flush immediately when batch is full
        if (buffer.length >= BATCH_SIZE) {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
            await flush(ch);
        } else {
            // Otherwise start the countdown timer so nothing sits too long
            scheduleFlush(ch);
        }
    });

    // Graceful shutdown — flush whatever is in the buffer before exiting
    async function shutdown(signal) {
        console.log(`[logging-service] ${signal} — flushing buffer and closing…`);
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        await flush(ch);
        await ch.close();
        await conn.close();
        process.exit(0);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

// Minimal health-check server — logging-service has no Express HTTP server otherwise
const healthApp = express();
healthApp.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'logging-service', uptime: process.uptime() });
});
const HEALTH_PORT = process.env.HEALTH_PORT || 3006;
healthApp.listen(HEALTH_PORT, () => {
    console.log(`[logging-service] Health endpoint listening on :${HEALTH_PORT}/health`);
});

start().catch((err) => {
    console.error('[logging-service] Fatal startup error:', err.message);
    process.exit(1);
});
