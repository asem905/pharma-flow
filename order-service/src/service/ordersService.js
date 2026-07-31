import ordersModel from "../model/ordersModel.js";
import appError from "../utils/appError.js";
import { getProductsInfo, decrementStock } from "../grpc/productGrpcClient.js";
import {
    publishOrderPlaced,
    publishOrderCancelled,
    publishOrderDeleted,
    publishStockAdjust,
    publishOrderUpdated,
} from "../events/orderPublisher.js";

export class OrdersService {

    static async createOrder(data, userId) {
        const { idempotencyKey, orderItems } = data;
        console.log(`[createOrder] user=${userId} | items=${orderItems.length} | key=${idempotencyKey}`);

        //  Idempotency check
        const existing = await ordersModel.findByIdempotencyKey(idempotencyKey);
        if (existing) {
            console.log(`[createOrder] Duplicate request — returning existing order ${existing.id}`);
            return existing;
        }

        //  Batch-fetch price + stock via gRPC
        const productIds = orderItems.map((item) => item.productId);
        let productsInfo;
        try {
            console.log(`[createOrder] gRPC getProductsInfo → ${productIds.length} product(s)`);
            const response = await getProductsInfo({ product_ids: productIds });
            productsInfo = response.products;
            console.log(`[createOrder] gRPC getProductsInfo ✔ received ${productsInfo.length} result(s)`);
        } catch (err) {
            console.error("[createOrder] gRPC getProductsInfo ✖ failed:", err.message);
            return appError.createErrorResponse("Product service unavailable", 503, "fail");
        }

        //  Validate: existence + sufficient stock
        const productMap = new Map(productsInfo.map((p) => [p.product_id, p]));
        for (const item of orderItems) {
            const info = productMap.get(item.productId);
            if (!info || !info.found) {
                console.warn(`[createOrder] Product not found: ${item.productId}`);
                return appError.createErrorResponse(`Product '${item.productId}' not found`, 404, "fail");
            }
            if (info.stock < item.quantity) {
                console.warn(`[createOrder] Insufficient stock for ${item.productId}: available=${info.stock}, requested=${item.quantity}`);
                return appError.createErrorResponse(
                    `Insufficient stock for product '${item.productId}' (available: ${info.stock}, requested: ${item.quantity})`,
                    409, "fail"
                );
            }
        }

        //  Snapshot prices + compute totalPrice
        const enrichedItems = orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: productMap.get(item.productId).price,
        }));

        const totalPrice = enrichedItems
            .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
            .toFixed(2);
        console.log(`[createOrder] totalPrice=$${totalPrice} | items:`, enrichedItems.map(i => `${i.productId} x${i.quantity} @${i.price}`));

        //  Decrement stock via gRPC
        const stockUpdates = enrichedItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
        }));

        let decrementResult;
        try {
            console.log(`[createOrder] gRPC decrementStock → reserving stock for ${stockUpdates.length} product(s)`);
            decrementResult = await decrementStock({ updates: stockUpdates });
            console.log(`[createOrder] gRPC decrementStock ✔ success=${decrementResult.success}`);
        } catch (err) {
            console.error("[createOrder] gRPC decrementStock ✖ failed:", err.message);
            return appError.createErrorResponse("Failed to reserve stock", 503, "fail");
        }

        if (!decrementResult.success) {
            console.warn(`[createOrder] Stock decrement rejected: product=${decrementResult.failed_product_id} | ${decrementResult.message}`);
            return appError.createErrorResponse(
                `Stock error for product '${decrementResult.failed_product_id}': ${decrementResult.message}`,
                409, "fail"
            );
        }

        //  Create order + items atomically in DB
        try {
            const order = await ordersModel.createOrder(userId, idempotencyKey, totalPrice, enrichedItems);
            console.log(`[createOrder] ✔ Order created: id=${order.id} total=$${order.totalPrice}`);
            publishOrderPlaced(order);
            return order;
        } catch (err) {
            console.error("[createOrder] ✖ DB write failed — rolling back stock via RabbitMQ:", err.message);
            publishOrderDeleted({ id: "rollback", orderItems: enrichedItems.map(i => ({ productId: i.productId, quantity: i.quantity })) });
            return appError.createErrorResponse("Failed to create order", 500, "fail");
        }
    }

    static async deleteOrder(orderId) {
        console.log(`[deleteOrder] orderId=${orderId}`);

        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            console.warn(`[deleteOrder] Order not found: ${orderId}`);
            return appError.createErrorResponse("Order not found", 404, "fail");
        }
        console.log(`[deleteOrder] Found order status=${order.status} | items=${order.orderItems.length}`);

        // Only restore stock that is still reserved (CANCELLED already released it)
        const restorableStatuses = ["PENDING", "CONFIRMED"];
        const shouldRestoreStock = restorableStatuses.includes(order.status);

        const deleted = await ordersModel.deleteOrder(orderId);
        console.log(`[deleteOrder] ✔ Order deleted: ${orderId}`);

        if (shouldRestoreStock && order.orderItems.length > 0) {
            console.log(`[deleteOrder] Publishing stock restore for ${order.orderItems.length} item(s) via RabbitMQ`);
            publishOrderDeleted(order);
        } else {
            console.log(`[deleteOrder] No stock restore needed (status=${order.status})`);
        }

        return deleted;
    }

    static async updateOrder(orderId, data) {
        console.log(`[updateOrder] orderId=${orderId} | fields: ${Object.keys(data).join(", ")}`);

        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            console.warn(`[updateOrder] Order not found: ${orderId}`);
            return appError.createErrorResponse("Order not found", 404, "fail");
        }
        console.log(`[updateOrder] Current status=${order.status}`);

        //  Status change to CANCELLED: restore all reserved stock
        if (data.status === "CANCELLED" && order.status !== "CANCELLED") {
            console.log(`[updateOrder] Status → CANCELLED | publishing stock restore for ${order.orderItems.length} item(s)`);
            publishOrderCancelled(order);
        }

        if (data.orderItems && order.status !== "CANCELLED") {
            const oldItemMap = new Map(order.orderItems.map((oi) => [oi.productId, oi.quantity]));

            const toDecrement = [];
            const toIncrement = [];
            const newProductIds = data.orderItems.map(i => i.productId);

            let productsInfo;
            try {
                console.log(`[updateOrder] gRPC getProductsInfo → ${newProductIds.length} product(s)`);
                const response = await getProductsInfo({ product_ids: newProductIds });
                productsInfo = response.products;
                console.log(`[updateOrder] gRPC getProductsInfo ✔`);
            } catch (err) {
                console.error("[updateOrder] gRPC getProductsInfo ✖ failed:", err.message);
                return appError.createErrorResponse("Product service unavailable", 503, "fail");
            }
            const productMap = new Map(productsInfo.map((p) => [p.product_id, p]));

            const enrichedItems = [];
            let newTotalPrice = 0;

            for (const item of data.orderItems) {
                const oldQty = oldItemMap.get(item.productId) ?? 0;
                const delta = item.quantity - oldQty;
                if (delta > 0) toDecrement.push({ product_id: item.productId, quantity: delta });
                if (delta < 0) toIncrement.push({ productId: item.productId, quantity: -delta });

                const info = productMap.get(item.productId);
                if (!info || !info.found) {
                    console.warn(`[updateOrder] Product not found: ${item.productId}`);
                    return appError.createErrorResponse(`Product '${item.productId}' not found`, 404, "fail");
                }

                enrichedItems.push({ productId: item.productId, quantity: item.quantity, price: info.price });
                newTotalPrice += parseFloat(info.price) * item.quantity;
            }

            // Products present in the OLD order but completely absent from the NEW order
            // must have their full quantity returned to stock — the loop above never visits them
            const newProductIdSet = new Set(data.orderItems.map(i => i.productId));
            for (const [productId, oldQty] of oldItemMap) {
                if (!newProductIdSet.has(productId)) {
                    console.log(`[updateOrder] Product ${productId} fully removed — restoring qty=${oldQty} to stock`);
                    toIncrement.push({ productId, quantity: oldQty });
                }
            }

            console.log(`[updateOrder] Delta summary: toDecrement=${toDecrement.length} toIncrement=${toIncrement.length} | newTotal=$${newTotalPrice.toFixed(2)}`);

            if (toDecrement.length > 0) {
                // Check stock before decrementing
                for (const item of toDecrement) {
                    const info = productMap.get(item.product_id);
                    if (info.stock < item.quantity) {
                        console.warn(`[updateOrder] Insufficient stock: product=${item.product_id} available=${info.stock} requested=${item.quantity}`);
                        return appError.createErrorResponse(`Insufficient stock for product '${item.product_id}'`, 409, "fail");
                    }
                }
                console.log(`[updateOrder] gRPC decrementStock → ${toDecrement.length} product(s)`);
                const decrementResult = await decrementStock({ updates: toDecrement });
                console.log(`[updateOrder] gRPC decrementStock ✔ success=${decrementResult.success}`);
                if (!decrementResult.success) {
                    console.warn(`[updateOrder] decrementStock rejected: product=${decrementResult.failed_product_id} | ${decrementResult.message}`);
                    return appError.createErrorResponse(
                        `Stock error for product '${decrementResult.failed_product_id}': ${decrementResult.message}`,
                        409, "fail"
                    );
                }
            }

            if (toIncrement.length > 0) {
                console.log(`[updateOrder] Publishing stock adjust (release) for ${toIncrement.length} product(s) via RabbitMQ`);
                publishStockAdjust(
                    orderId,
                    toIncrement.map((i) => ({ productId: i.productId, delta: i.quantity }))
                );
            }

            data.orderItems = { deleteMany: {}, create: enrichedItems };
            data.totalPrice = newTotalPrice.toFixed(2);
        }

        const updated = await ordersModel.updateOrder(orderId, data);
        console.log(`[updateOrder] ✔ Order updated: ${orderId} | status=${updated.status} total=$${updated.totalPrice}`);
        // Notify notification-service (and any future consumers) of the change
        publishOrderUpdated(updated);
        return updated;
    }

    static async findOrder(orderId) {
        console.log(`[findOrder] orderId=${orderId}`);
        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            console.warn(`[findOrder] Order not found: ${orderId}`);
            return appError.createErrorResponse("Order not found", 404, "fail");
        }
        return order;
    }

    static async findAllOrders() {
        console.log(`[findAllOrders] Fetching all orders`);
        return await ordersModel.findAllOrders();
    }

    static async findOrdersForCustomer(customerId, filters = {}) {
        console.log(`[findOrdersForCustomer] customerId=${customerId} | filters:`, filters);
        return await ordersModel.findOrdersForCustomer(customerId, filters);
    }
}
