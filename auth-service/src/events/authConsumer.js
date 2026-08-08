import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
import UsersModel from "../model/usersModel.js";

const QUEUE = "auth.payments";

// Two routing keys — this queue wakes up for overpayments and refunds
const BINDINGS = ["payment.overpaid", "payment.refunded"];

export async function startAuthConsumer() {
    const channel = getChannel();

    // Durable queue — survives broker restart
    await channel.assertQueue(QUEUE, { durable: true });

    // Bind queue to the routing keys
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
            const { userId, remainingAmount, amount, orderId } = payload;

            // For overpaid, remainingAmount is credited. For refunded, amount is credited.
            let creditAmount = routingKey === "payment.overpaid" ? remainingAmount : amount;
            if (creditAmount) creditAmount = parseFloat(creditAmount);

            if (!userId || !creditAmount) {
                console.warn(`[Auth Consumer] Missing userId or credit amount in ${routingKey} — acking and skipping`);
                channel.ack(msg);
                return;
            }

            // Atomically increment the user's budget
            await UsersModel.update(userId, {
                budget: { increment: creditAmount }
            });

            channel.ack(msg);
            console.log(`[Auth Consumer] ✔ Budget credited via ${routingKey} | userId=${userId} +${creditAmount} (order=${orderId})`);
        } catch (err) {
            console.error(`[Auth Consumer] ✖ Failed to process ${routingKey}:`, err.message);
            // requeue=false: don't loop forever on a broken message
            channel.nack(msg, false, false);
        }
    });

    console.log(`[RabbitMQ] Auth consumer ready — queue: ${QUEUE} | bindings: ${BINDINGS.join(", ")}`);
}
