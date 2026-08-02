import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
import Notification from "../models/Notification.js";

const QUEUE = "notifications.orders";

// Routing keys this service cares about
const BINDINGS = [
    "order.placed",
    "order.cancelled",
    "order.updated",
];

// Maps a routing key → notification type enum value
const TYPE_MAP = {
    "order.placed":    "ORDER_PLACED",
    "order.cancelled": "ORDER_CANCELLED",
    "order.updated":   "ORDER_UPDATED",
};

// Maps a routing key → human-readable title + message builder
const MESSAGE_BUILDERS = {
    "order.placed": (payload) => ({
        title: "Order Placed Successfully",
        message: `Your order #${payload.orderId} has been placed. Total: $${payload.totalPrice}.`,
    }),
    "order.cancelled": (payload) => ({
        title: "Order Cancelled",
        message: `Your order #${payload.orderId} has been cancelled.`,
    }),
    "order.updated": (payload) => ({
        title: "Order Updated",
        message: `Your order #${payload.orderId} status is now ${payload.status}. Total: $${payload.totalPrice}.`,
    }),
};

export async function startNotificationConsumer() {
    const channel = getChannel();

    // Durable queue — survives broker restart
    await channel.assertQueue(QUEUE, { durable: true });

    // Bind the single queue to all relevant routing keys
    for (const key of BINDINGS) {
        await channel.bindQueue(QUEUE, EXCHANGE, key);
    }

    // Process one message at a time
    channel.prefetch(1);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        const routingKey = msg.fields.routingKey;

        try {
            const payload = JSON.parse(msg.content.toString());
            const { email, orderId } = payload;

            // Guard: email must be present — admin-initiated updates won't have one
            if (!email) {
                console.warn(`[Consumer] ${routingKey} — no email in payload, skipping notification for order ${orderId}`);
                channel.ack(msg);
                return;
            }

            const type = TYPE_MAP[routingKey];
            const builder = MESSAGE_BUILDERS[routingKey];

            if (!type || !builder) {
                console.warn(`[Consumer] Unknown routing key: ${routingKey} — acking and skipping`);
                channel.ack(msg);
                return;
            }

            const { title, message } = builder(payload);

            await Notification.create({
                email,
                type,
                title,
                message,
                payload,           // store full event data for traceability
            });

            channel.ack(msg);
            console.log(`[Consumer] ✔ Notification saved | event=${routingKey} email=${email} order=${orderId}`);
        } catch (err) {
            console.error(`[Consumer] ✖ Failed to process ${routingKey}:`, err.message);
            // requeue=false: don't loop forever on a broken message
            channel.nack(msg, false, false);
        }
    });

    console.log(`[RabbitMQ] Notification consumer ready — queue: ${QUEUE} | bindings: ${BINDINGS.join(", ")}`);
}
