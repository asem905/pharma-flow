import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
//as a publisher you just send to exchange then consumers connect to queues made for them
// Internal helper — serializes and publishes to exchange
function publish(routingKey, payload) {
    const channel = getChannel();
    const message = Buffer.from(JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(), // added here — no need to pass it in
    }));
    // persistent: true → message survives broker restart
    channel.publish(EXCHANGE, routingKey, message, { persistent: true });

    console.log(`[Publisher] ${routingKey}`, payload);
}

// ── Public event publishers ───────────────────────────────────────────────────

export const publishPaymentSuccess = (payment, email) =>
    publish("payment.success", {
        event: "payment.success",
        orderId: payment.orderId,
        userId: payment.userId,
        email,
        amount: payment.amount.toString(),
        paymentMethod: payment.paymentMethod,
    });

export const publishPaymentFailed = (payment, email) =>
    publish("payment.failed", {
        event: "payment.failed",
        orderId: payment.orderId,
        userId: payment.userId,
        email,
        amount: payment.amount.toString(),
        paymentMethod: payment.paymentMethod,
    });

export const publishPaymentRefunded = (payment) =>
    publish("payment.refunded", {
        event: "payment.refunded",
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount.toString(),
        paymentMethod: payment.paymentMethod,
    });
