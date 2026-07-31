import ordersModel from "../model/ordersModel.js";
import appError from "../utils/appError.js";
import { getProductsInfo, decrementStock } from "../grpc/productGrpcClient.js";
import {
    publishOrderPlaced,
    publishOrderCancelled,
    publishOrderDeleted,
    publishStockAdjust,
} from "../events/orderPublisher.js";

export class OrdersService {

    static async createOrder(data, userId) {
        const { idempotencyKey, orderItems } = data;

        //  Idempotency check 
        // Same request retried → return existing order, no duplicate, no re-decrement
        const existing = await ordersModel.findByIdempotencyKey(idempotencyKey);
        if (existing) return existing;

        //  Batch-fetch price + stock via gRPC 
        const productIds = orderItems.map((item) => item.productId);
        let productsInfo;
        try {
            const response = await getProductsInfo({ product_ids: productIds });
            productsInfo = response.products;
        } catch (err) {
            console.error("[OrdersService] gRPC getProductsInfo failed:", err);
            return appError.createErrorResponse("Product service unavailable", 503, "fail");
        }

        //  Validate: existence + sufficient stock 
        const productMap = new Map(productsInfo.map((p) => [p.product_id, p]));
        for (const item of orderItems) {
            const info = productMap.get(item.productId);
            if (!info || !info.found) {
                return appError.createErrorResponse(`Product '${item.productId}' not found`, 404, "fail");
            }
            if (info.stock < item.quantity) {
                return appError.createErrorResponse(
                    `Insufficient stock for product '${item.productId}' (available: ${info.stock}, requested: ${item.quantity})`,
                    409, "fail"
                );
            }
        }

        //  Snapshot prices + compute totalPrice 
        // Price is fetched from product-service — never trust client-sent price
        const enrichedItems = orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: productMap.get(item.productId).price, // string Decimal e.g. "12.50"
        }));

        const totalPrice = enrichedItems
            .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
            .toFixed(2);

        //  Decrement stock via gRPC 
        const stockUpdates = enrichedItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
        }));

        let decrementResult;
        try {
            decrementResult = await decrementStock({ updates: stockUpdates });
        } catch (err) {
            console.error("[OrdersService] gRPC decrementStock failed:", err);
            return appError.createErrorResponse("Failed to reserve stock", 503, "fail");
        }

        if (!decrementResult.success) {
            return appError.createErrorResponse(
                `Stock error for product '${decrementResult.failed_product_id}': ${decrementResult.message}`,
                409, "fail"
            );
        }

        //  Create order + items atomically in DB
        try {
            const order = await ordersModel.createOrder(userId, idempotencyKey, totalPrice, enrichedItems);
            // Notify other services async — does not block the response
            publishOrderPlaced(order);
            return order;
        } catch (err) {
            //  Compensating rollback: restore stock on DB failure
            // Published to RabbitMQ — guaranteed delivery even if product-service is momentarily down
            publishOrderDeleted({ id: "rollback", orderItems: enrichedItems.map(i => ({ productId: i.productId, quantity: i.quantity })) });
            console.error("[OrdersService] Order DB write failed:", err);
            return appError.createErrorResponse("Failed to create order", 500, "fail");
        }
    }

    static async deleteOrder(orderId) {
        // Must fetch items BEFORE delete — cascade will wipe them
        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "fail");
        }

        // Only restore stock that is still reserved (CANCELLED already released it)
        const restorableStatuses = ["PENDING", "CONFIRMED"];
        const shouldRestoreStock = restorableStatuses.includes(order.status);

        const deleted = await ordersModel.deleteOrder(orderId);

        // Publish to RabbitMQ — product-service consumer restores stock
        // Durable: message is retained even if product-service is temporarily down
        if (shouldRestoreStock && order.orderItems.length > 0) {
            publishOrderDeleted(order);
        }

        return deleted;
    }

    static async updateOrder(orderId, data) {
        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "fail");
        }

        //  Status change to CANCELLED: restore all reserved stock
        if (data.status === "CANCELLED" && order.status !== "CANCELLED") {
            // Publish to RabbitMQ — product-service restores stock, notification-service sends email
            publishOrderCancelled(order);
        }


        if (data.orderItems && order.status !== "CANCELLED") {
            const oldItemMap = new Map(order.orderItems.map((oi) => [oi.productId, oi.quantity]));

            const toDecrement = []; // qty increased → need more stock
            const toIncrement = []; // qty decreased → release excess stock

            for (const item of data.orderItems) {
                const oldQty = oldItemMap.get(item.productId) ?? 0;
                const delta = item.quantity - oldQty;
                if (delta > 0) toDecrement.push({ product_id: item.productId, quantity: delta });
                if (delta < 0) toIncrement.push({ product_id: item.productId, quantity: -delta });
            }

            if (toDecrement.length > 0) {
                // check stock before decrementing (still gRPC sync — must verify availability)
                const productIds = toDecrement.map((item) => item.product_id);
                const productsInfo = await getProductsInfo({ product_ids: productIds });
                const productMap = new Map(productsInfo.products.map((p) => [p.product_id, p]));
                for (const item of toDecrement) {
                    const info = productMap.get(item.product_id);
                    if (!info || info.stock < item.quantity) {
                        return appError.createErrorResponse(`Insufficient stock for product '${item.product_id}'`, 409, "fail");
                    }
                }
                // Sync gRPC decrement — quantity increased, need to reserve more stock now
                decrementStock({ updates: toDecrement })
                    .catch((err) => console.error("[CRITICAL] Stock adjust (increase) failed:", err));
            }
            if (toIncrement.length > 0) {
                // Async via RabbitMQ — quantity decreased, return excess stock
                publishStockAdjust(
                    orderId,
                    toIncrement.map((i) => ({ productId: i.product_id, delta: i.quantity }))
                );
            }
        }

        return await ordersModel.updateOrder(orderId, data);
    }

    static async findOrder(orderId) {
        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "fail");
        }
        return order;
    }

    static async findAllOrders() {
        return await ordersModel.findAllOrders();
    }

    static async findOrdersForCustomer(customerId, filters = {}) {
        return await ordersModel.findOrdersForCustomer(customerId, filters);
    }
}
