import ordersModel from "../model/ordersModel.js";
import appError from "../utils/appError.js";

// Circuit Breaker
import CircuitBreaker from "opossum";
import { circuitBreakerOptions } from "../config/circuitBreaker.config.js";

// gRPC
import { getProductsInfo, validateAndReserveStock, decrementStock } from "../grpc/productGrpcClient.js";

// RabbitMQ Events
import {
    publishOrderPlaced,
    publishOrderCancelled,
    publishOrderDeleted,
    publishStockAdjust,
    publishOrderUpdated,
} from "../events/orderPublisher.js";


// ------------------------ Circuit Breaker for getProductsInfo ------------------------
const getProductsInfoBreaker = new CircuitBreaker(getProductsInfo, circuitBreakerOptions);
getProductsInfoBreaker.fallback(() => ({ __circuitOpen: true }));
getProductsInfoBreaker.on("open",     () => console.log("[CB] getProductsInfoBreaker is OPEN — fast-failing all calls"));
getProductsInfoBreaker.on("halfOpen", () => console.log("[CB] getProductsInfoBreaker is HALF OPEN — probing product service"));
getProductsInfoBreaker.on("close",    () => console.log("[CB] getProductsInfoBreaker is CLOSED — product service recovered"));
getProductsInfoBreaker.on("fallback", () => console.warn("[CB] getProductsInfoBreaker FALLBACK triggered (circuit is open or timed out)"));

// ------------------------ Circuit Breaker for validateAndReserveStock ------------------------
const validateAndReserveStockBreaker = new CircuitBreaker(
    validateAndReserveStock,
    circuitBreakerOptions
);
validateAndReserveStockBreaker.fallback(() => ({ __circuitOpen: true }));
validateAndReserveStockBreaker.on("open",     () => console.log("[CB] validateAndReserveStockBreaker is OPEN — fast-failing all calls"));
validateAndReserveStockBreaker.on("halfOpen", () => console.log("[CB] validateAndReserveStockBreaker is HALF OPEN — probing product service"));
validateAndReserveStockBreaker.on("close",    () => console.log("[CB] validateAndReserveStockBreaker is CLOSED — product service recovered"));
validateAndReserveStockBreaker.on("fallback", () => console.warn("[CB] validateAndReserveStockBreaker FALLBACK triggered (circuit is open or timed out)"));

// ------------------------ Circuit Breaker for decrementStock ------------------------
const decrementStockBreaker = new CircuitBreaker(decrementStock, circuitBreakerOptions);
decrementStockBreaker.fallback(() => ({ __circuitOpen: true }));
decrementStockBreaker.on("open",     () => console.log("[CB] decrementStockBreaker is OPEN — fast-failing all calls"));
decrementStockBreaker.on("halfOpen", () => console.log("[CB] decrementStockBreaker is HALF OPEN — probing product service"));
decrementStockBreaker.on("close",    () => console.log("[CB] decrementStockBreaker is CLOSED — product service recovered"));
decrementStockBreaker.on("fallback", () => console.warn("[CB] decrementStockBreaker FALLBACK triggered (circuit is open or timed out)"));

export class OrdersService {

    static async createOrder(data, userId, email) {
        const { idempotencyKey, orderItems } = data;
        console.log(`[createOrder] user=${userId} email=${email} | items=${orderItems.length} | key=${idempotencyKey}`);

        //  Idempotency check
        const existing = await ordersModel.findByIdempotencyKey(idempotencyKey);
        if (existing) {
            console.log(`[createOrder] Duplicate request — returning existing order ${existing.id}`);
            return existing;
        }

        // Single gRPC call: validate existence, check stock, snapshot prices, decrement
        // Replaces: getProductsInfo (1 call) + decrementStock (1 call) = 2 round trips
        const reserveItems = orderItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
        }));

        let reserveResult;
        try {
            console.log(`[createOrder] gRPC validateAndReserveStock → ${reserveItems.length} item(s)`);
            reserveResult = await validateAndReserveStockBreaker.fire({ items: reserveItems });
        } catch (err) {
            console.error("[createOrder] gRPC validateAndReserveStock ✖ failed:", err.message);
            return appError.createErrorResponse("Product service unavailable", 503, "fail");
        }
        if (reserveResult.__circuitOpen) {
            console.warn("[createOrder] validateAndReserveStockBreaker is OPEN — returning 503 immediately (no gRPC call made)");
            return appError.createErrorResponse("Product service unavailable", 503, "fail");
        }
        console.log(`[createOrder] gRPC validateAndReserveStock ✔ success=${reserveResult.success}`);

        if (!reserveResult.success) {
            console.warn(`[createOrder] Reserve rejected: product=${reserveResult.failed_product_id} | ${reserveResult.message}`);
            return appError.createErrorResponse(
                `Stock error for product '${reserveResult.failed_product_id}': ${reserveResult.message}`,
                409, "fail"
            );
        }

        // Build enriched items from the price snapshot returned by the gRPC call
        const priceMap = new Map(reserveResult.reserved.map((r) => [r.product_id, r.price]));
        const enrichedItems = orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: priceMap.get(item.productId),
        }));

        const totalPrice = enrichedItems
            .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
            .toFixed(2);
        console.log(`[createOrder] totalPrice=$${totalPrice}`);

        //  Create order + items atomically in DB
        try {
            const order = await ordersModel.createOrder(userId, idempotencyKey, totalPrice, enrichedItems);
            console.log(`[createOrder] ✔ Order created: id=${order.id} total=$${order.totalPrice}`);
            publishOrderPlaced(order, email);
            return order;
        } catch (err) {
            console.error("[createOrder] ✖ DB write failed — rolling back stock via RabbitMQ:", err.message);
            // Stock was already decremented by the gRPC call — restore it via RabbitMQ
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

    static async updateOrder(orderId, data, email) {
        console.log(`[updateOrder] orderId=${orderId} email=${email} | fields: ${Object.keys(data).join(", ")}`);
        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            console.warn(`[updateOrder] Order not found: ${orderId}`);
            return appError.createErrorResponse("Order not found", 404, "fail");
        }
        console.log(`[updateOrder] Current status=${order.status}`);

        //  Status change to CANCELLED: restore all reserved stock
        if (data.status === "CANCELLED" && order.status !== "CANCELLED") {
            console.log(`[updateOrder] Status → CANCELLED | publishing stock restore for ${order.orderItems.length} item(s)`);
            publishOrderCancelled(order, email);
        }

        if (data.orderItems && order.status !== "CANCELLED") {
            const oldItemMap = new Map(order.orderItems.map((oi) => [oi.productId, oi.quantity]));

            const toDecrement = [];
            const toIncrement = [];
            const newProductIds = data.orderItems.map(i => i.productId);

            let productsInfo;
            try {
                console.log(`[updateOrder] gRPC getProductsInfo → ${newProductIds.length} product(s)`);
                const response = await getProductsInfoBreaker.fire({ product_ids: newProductIds });
                if (response.__circuitOpen) {
                    console.warn("[updateOrder] getProductsInfoBreaker is OPEN — returning 503 immediately (no gRPC call made)");
                    return appError.createErrorResponse("Product service unavailable", 503, "fail");
                }
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
                const decrementResult = await decrementStockBreaker.fire({ updates: toDecrement });
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
        // Fire-and-forget: publish() writes to amqplib's internal buffer and returns immediately.
        // The HTTP response is sent before the broker even receives the bytes — no blocking.
        publishOrderUpdated(updated, email);
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

    static async findAllOrders(filters = {}) {
        console.log(`[findAllOrders] Fetching all orders | filters:`, filters);
        return await ordersModel.findAllOrders(filters);
    }

    static async findOrdersForCustomer(customerId, filters = {}) {
        console.log(`[findOrdersForCustomer] customerId=${customerId} | filters:`, filters);
        return await ordersModel.findOrdersForCustomer(customerId, filters);
    }
}
