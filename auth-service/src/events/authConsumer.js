import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
import UsersModel from "../model/usersModel.js";

const QUEUE = "auth.payments";

// Only one routing key — this queue only wakes up when there's an actual overpayment
const BINDINGS = ["payment.overpaid"];

export async function startAuthConsumer() {
    const channel = getChannel();

    // Durable queue — survives broker restart
    await channel.assertQueue(QUEUE, { durable: true });

    // Bind queue to the overpaid routing key only
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
            const { userId, remainingAmount, orderId } = payload;

            if (!userId || !remainingAmount) {
                console.warn(`[Auth Consumer] Missing userId or remainingAmount in ${routingKey} — acking and skipping`);
                channel.ack(msg);
                return;
            }

            // Atomically increment the user's budget by the overpaid amount
            await UsersModel.update(userId, {
                budget: { increment: remainingAmount }
            });

            channel.ack(msg);
            console.log(`[Auth Consumer] ✔ Budget credited | userId=${userId} +${remainingAmount} (order=${orderId})`);
        } catch (err) {
            console.error(`[Auth Consumer] ✖ Failed to process ${routingKey}:`, err.message);
            // requeue=false: don't loop forever on a broken message
            channel.nack(msg, false, false);
        }
    });

    console.log(`[RabbitMQ] Auth consumer ready — queue: ${QUEUE} | bindings: ${BINDINGS.join(", ")}`);
}
