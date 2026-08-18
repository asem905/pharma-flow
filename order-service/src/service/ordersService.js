import ordersModel from "../model/ordersModel.js";
import appError from "../utils/appError.js";
import logger from "../utils/logger.js";

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
getProductsInfoBreaker.on("open", () => logger.warn("Circuit OPEN — product-service unreachable", { breaker: "getProductsInfo" }));
getProductsInfoBreaker.on("halfOpen", () => logger.info("Circuit HALF-OPEN — probing product-service", { breaker: "getProductsInfo" }));
getProductsInfoBreaker.on("close", () => logger.info("Circuit CLOSED — product-service recovered", { breaker: "getProductsInfo" }));
getProductsInfoBreaker.on("fallback", () => logger.warn("Circuit fallback triggered", { breaker: "getProductsInfo" }));

// ------------------------ Circuit Breaker for validateAndReserveStock ------------------------
const validateAndReserveStockBreaker = new CircuitBreaker(
    validateAndReserveStock,
    circuitBreakerOptions
);
validateAndReserveStockBreaker.fallback(() => ({ __circuitOpen: true }));
validateAndReserveStockBreaker.on("open", () => logger.warn("Circuit OPEN — product-service unreachable", { breaker: "validateAndReserveStock" }));
validateAndReserveStockBreaker.on("halfOpen", () => logger.info("Circuit HALF-OPEN — probing product-service", { breaker: "validateAndReserveStock" }));
validateAndReserveStockBreaker.on("close", () => logger.info("Circuit CLOSED — product-service recovered", { breaker: "validateAndReserveStock" }));
validateAndReserveStockBreaker.on("fallback", () => logger.warn("Circuit fallback triggered", { breaker: "validateAndReserveStock" }));

// ------------------------ Circuit Breaker for decrementStock ------------------------
const decrementStockBreaker = new CircuitBreaker(decrementStock, circuitBreakerOptions);
decrementStockBreaker.fallback(() => ({ __circuitOpen: true }));
decrementStockBreaker.on("open", () => logger.warn("Circuit OPEN — product-service unreachable", { breaker: "decrementStock" }));
decrementStockBreaker.on("halfOpen", () => logger.info("Circuit HALF-OPEN — probing product-service", { breaker: "decrementStock" }));
decrementStockBreaker.on("close", () => logger.info("Circuit CLOSED — product-service recovered", { breaker: "decrementStock" }));
decrementStockBreaker.on("fallback", () => logger.warn("Circuit fallback triggered", { breaker: "decrementStock" }));

export class OrdersService {

    static async createOrder(data, userId, email) {
        const { idempotencyKey, orderItems } = data;

        //  Idempotency check
        const existing = await ordersModel.findByIdempotencyKey(idempotencyKey);
        if (existing) {
            return existing;
        }

        const reserveItems = orderItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
        }));

        let reserveResult;
        try {
            reserveResult = await validateAndReserveStockBreaker.fire({ items: reserveItems });
        } catch (err) {
            logger.error("gRPC validateAndReserveStock failed", { userId, error: err.message });
            return appError.createErrorResponse("Product service unavailable", 503, "fail");
        }
        if (reserveResult.__circuitOpen) {
            logger.warn("Order blocked — product-service circuit is OPEN", { userId, itemCount: orderItems.length });
            return appError.createErrorResponse("Product service unavailable", 503, "fail");
        }

        if (!reserveResult.success) {
            logger.warn("Stock reservation rejected", {
                userId,
                productId: reserveResult.failed_product_id,
                reason: reserveResult.message,
            });
            return appError.createErrorResponse(
                `Stock error for product '${reserveResult.failed_product_id}': ${reserveResult.message}`,
                409, "fail"
            );
        }

        const priceMap = new Map(reserveResult.reserved.map((r) => [r.product_id, r.price]));
        const enrichedItems = orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: priceMap.get(item.productId),
        }));

        const totalPrice = enrichedItems
            .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
            .toFixed(2);

        //  Create order + items atomically in DB
        try {
            const order = await ordersModel.createOrder(userId, idempotencyKey, totalPrice, enrichedItems);
            logger.info("Order created", { orderId: order.id, userId, total: order.totalPrice, itemCount: orderItems.length });
            publishOrderPlaced(order, email);
            return order;
        } catch (err) {
            logger.error("DB write failed — rolling back stock", { userId, error: err.message });
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

        const restorableStatuses = ["PENDING", "CONFIRMED"];
        const shouldRestoreStock = restorableStatuses.includes(order.status);

        const deleted = await ordersModel.deleteOrder(orderId);
        logger.info("Order deleted", { orderId, status: order.status, stockRestored: shouldRestoreStock });

        if (shouldRestoreStock && order.orderItems.length > 0) {
            publishOrderDeleted(order);
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

        //  Status change to CANCELLED
        if (data.status === "CANCELLED" && order.status !== "CANCELLED") {
            logger.info("Order cancelled — releasing stock", { orderId, userId: order.userId, itemCount: order.orderItems.length });
            publishOrderCancelled(order, email);
        }

        if (data.orderItems && order.status !== "CANCELLED") {
            const oldItemMap = new Map(order.orderItems.map((oi) => [oi.productId, oi.quantity]));

            const toDecrement = [];
            const toIncrement = [];
            const newProductIds = data.orderItems.map(i => i.productId);

            let productsInfo;
            try {
                const response = await getProductsInfoBreaker.fire({ product_ids: newProductIds });
                if (response.__circuitOpen) {
                    logger.warn("Order update blocked — product-service circuit is OPEN", { orderId });
                    return appError.createErrorResponse("Product service unavailable", 503, "fail");
                }
                productsInfo = response.products;
            } catch (err) {
                logger.error("gRPC getProductsInfo failed during order update", { orderId, error: err.message });
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

            const newProductIdSet = new Set(data.orderItems.map(i => i.productId));
            for (const [productId, oldQty] of oldItemMap) {
                if (!newProductIdSet.has(productId)) {
                    toIncrement.push({ productId, quantity: oldQty });
                }
            }

            if (toDecrement.length > 0) {
                for (const item of toDecrement) {
                    const info = productMap.get(item.product_id);
                    if (info.stock < item.quantity) {
                        logger.warn("Insufficient stock during order update", {
                            orderId,
                            productId: item.product_id,
                            available: info.stock,
                            requested: item.quantity,
                        });
                        return appError.createErrorResponse(`Insufficient stock for product '${item.product_id}'`, 409, "fail");
                    }
                }
                const decrementResult = await decrementStockBreaker.fire({ updates: toDecrement });
                if (!decrementResult.success) {
                    logger.warn("Stock decrement rejected during order update", {
                        orderId,
                        productId: decrementResult.failed_product_id,
                        reason: decrementResult.message,
                    });
                    return appError.createErrorResponse(
                        `Stock error for product '${decrementResult.failed_product_id}': ${decrementResult.message}`,
                        409, "fail"
                    );
                }
            }

            if (toIncrement.length > 0) {
                publishStockAdjust(
                    orderId,
                    toIncrement.map((i) => ({ productId: i.productId, delta: i.quantity }))
                );
            }

            data.orderItems = { deleteMany: {}, create: enrichedItems };
            data.totalPrice = newTotalPrice.toFixed(2);
        }

        const updated = await ordersModel.updateOrder(orderId, data);
        logger.info("Order updated", { orderId, status: updated.status, total: updated.totalPrice });
        publishOrderUpdated(updated, email);
        return updated;
    }

    static async findOrder(orderId) {
        const order = await ordersModel.findOrder(orderId);
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "fail");
        }
        return order;
    }

    static async findAllOrders(filters = {}) {
        return await ordersModel.findAllOrders(filters);
    }

    static async findOrdersForCustomer(customerId, filters = {}) {
        return await ordersModel.findOrdersForCustomer(customerId, filters);
    }
}
