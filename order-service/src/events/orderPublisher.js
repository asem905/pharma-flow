import { getChannel, EXCHANGE } from "../config/rabbitmq.js";
//as a publisher you just send to exchange then consumers connect to queues made for them
// Internal helper — serializes and publishes to exchange
function publish(routingKey, payload) {
    const channel = getChannel();
    const message = Buffer.from(JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
    }));
    // persistent: true → message survives broker restart
    channel.publish(EXCHANGE, routingKey, message, { persistent: true });

    console.log(`[Publisher] ${routingKey}`, payload);
}

// ── Public event publishers ───────────────────────────────────────────────────

// Called after a successful order creation
export const publishOrderPlaced = (order, email) =>
    publish("order.placed", {
        event: "order.placed",
        orderId: order.id,
        userId: order.userId,
        email,
        totalPrice: order.totalPrice.toString(),
        itemCount: order.orderItems.length,
    });

// Called when order status changes to CANCELLED
// product-service restores stock; notification-service sends email
export const publishOrderCancelled = (order, email) =>
    publish("order.cancelled", {
        event: "order.cancelled",
        orderId: order.id,
        userId: order.userId,
        email,
        orderItems: order.orderItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
        })),
    });

// Called when order is hard-deleted
export const publishOrderDeleted = (order) =>
    publish("order.deleted", {
        event: "order.deleted",
        orderId: order.id,
        orderItems: order.orderItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
        })),
    });

// Called when order item quantity DECREASES (excess stock returned)
// adjustments: [{ productId, delta }]  — delta is always positive (qty to return)
export const publishStockAdjust = (orderId, adjustments) =>
    publish("order.item.updated", {
        event: "order.item.updated",
        orderId,
        stockAdjustments: adjustments,
    });

// Called after any successful order update (status change, item change, etc.)
// notification-service will consume this to send "Your order was updated" email
export const publishOrderUpdated = (order, email) =>
    publish("order.updated", {
        event: "order.updated",
        orderId: order.id,
        userId: order.userId,
        email,
        status: order.status,
        totalPrice: order.totalPrice.toString(),
        orderItems: order.orderItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price.toString(),
        })),
    });
