import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
import ordersModel from "../model/ordersModel.js";

// This service only cares about payment outcomes to keep orders in sync
const QUEUE = "orders.payments";

// Routing keys this consumer subscribes to
const BINDINGS = [
    "payment.success",
    "payment.failed",
];

export async function startOrderConsumer() {
    const channel = getChannel();

    // Declare a durable queue — survives broker restart
    await channel.assertQueue(QUEUE, { durable: true });

    // Bind queue to the shared exchange for each routing key
    for (const key of BINDINGS) {
        await channel.bindQueue(QUEUE, EXCHANGE, key);
    }

    // Process one message at a time — prevents DB overload under high traffic
    channel.prefetch(1);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        const routingKey = msg.fields.routingKey;

        try {
            const payload = JSON.parse(msg.content.toString());
            const { orderId } = payload;

            if (!orderId) {
                console.warn(`[Consumer] ${routingKey} — missing orderId in payload, acking and skipping`);
                channel.ack(msg);
                return;
            }

            if (routingKey === "payment.success") {
                // Mark the order as CONFIRMED once payment succeeds
                await ordersModel.update({
                    where: { id: orderId },
                    data: { status: "CONFIRMED" },
                });
                console.log(`[Consumer] ✔ Order ${orderId} marked CONFIRMED after payment.success`);

            } else if (routingKey === "payment.failed") {
                // Payment failed — order stays PENDING so the user can retry.
                // We only log here; no status change needed unless business rules say otherwise.
                console.warn(`[Consumer] ⚠ Payment failed for order ${orderId} — order remains PENDING`);
            }

            channel.ack(msg);
        } catch (err) {
            console.error(`[Consumer] ✖ Failed to process ${routingKey}:`, err.message);
            // requeue=false: don't loop forever on a broken message
            channel.nack(msg, false, false);
        }
    });

    console.log(`[RabbitMQ] Order consumer ready — queue: ${QUEUE} | bindings: ${BINDINGS.join(", ")}`);
}
