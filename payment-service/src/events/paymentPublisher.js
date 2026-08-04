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

export const publishPaymentSuccess = (payment, email, remainingAmount = 0) =>
    publish("payment.success", {
        event: "payment.success",
        orderId: payment.orderId,
        userId: payment.userId,
        email,
        amount: payment.amount.toString(),
        paymentMethod: payment.method,
        remainingAmount,
    });

export const publishPaymentFailed = (payment, email) =>
    publish("payment.failed", {
        event: "payment.failed",
        orderId: payment.orderId,
        userId: payment.userId,
        email,
        amount: payment.amount.toString(),
        paymentMethod: payment.method,
    });

export const publishPaymentRefunded = (payment) =>
    publish("payment.refunded", {
        event: "payment.refunded",
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount.toString(),
        paymentMethod: payment.method,
    });

export const publishPaymentOverpaid = (payment, email, remainingAmount) =>
    publish("payment.overpaid", {
        event: "payment.overpaid",
        orderId: payment.orderId,
        userId: payment.userId,
        email,
        amount: payment.amount.toString(),
        paymentMethod: payment.method,
        remainingAmount,     // credits to be added to user budget
    });
