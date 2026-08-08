import axios from "axios";
import CircuitBreaker from "opossum";
import { circuitBreakerOptions } from "../config/circuitBreaker.config.js";

// ---------------------------------------------------------------------------
// Helper: build the x-current-user header forwarded to every downstream service
// ---------------------------------------------------------------------------
const userHeader = (currentUser) => ({
    "x-current-user": JSON.stringify(currentUser),
});

// ---------------------------------------------------------------------------
// Circuit Breaker factory
// One breaker per downstream SERVICE (not per endpoint).
// If auth-service is down → every auth endpoint fast-fails instantly.
// ---------------------------------------------------------------------------
function makeBreaker(name, fn) {
    const breaker = new CircuitBreaker(fn, circuitBreakerOptions);
    breaker.fallback(() => ({ __circuitOpen: true, service: name }));
    breaker.on("open",     () => console.log(`[CB] ${name} is OPEN — fast-failing all calls`));
    breaker.on("halfOpen", () => console.log(`[CB] ${name} is HALF OPEN — probing ${name}`));
    breaker.on("close",    () => console.log(`[CB] ${name} is CLOSED — ${name} recovered`));
    breaker.on("fallback", () => console.warn(`[CB] ${name} FALLBACK triggered`));
    breaker.on("reject",   () => console.warn(`[CB] ${name} REJECTED (circuit is open)`));
    return breaker;
}

// ---------------------------------------------------------------------------
// Raw axios callers — these are what the circuit breakers wrap
// ---------------------------------------------------------------------------
const _authCall    = (config) => axios(config);
const _productCall = (config) => axios(config);
const _orderCall   = (config) => axios(config);
const _notifCall   = (config) => axios(config);
const _paymentCall = (config) => axios(config);

// ---------------------------------------------------------------------------
// One breaker per downstream service
// ---------------------------------------------------------------------------
const authBreaker    = makeBreaker("auth-service",         _authCall);
const productBreaker = makeBreaker("product-service",      _productCall);
const orderBreaker   = makeBreaker("order-service",        _orderCall);
const notifBreaker   = makeBreaker("notification-service", _notifCall);
const paymentBreaker = makeBreaker("payment-service",      _paymentCall);

// ---------------------------------------------------------------------------
// Shared response handler
// Throws an enriched error on HTTP 4xx/5xx so the controller's catch
// can forward the original status code from the downstream service.
// ---------------------------------------------------------------------------
async function callBreaker(breaker, config) {
    const result = await breaker.fire(config);

    // Fallback sentinel — circuit is OPEN, no HTTP call was made
    if (result?.__circuitOpen) {
        const err = new Error(`${result.service} is currently unavailable`);
        err.statusCode = 503;
        throw err;
    }

    return result.data; // axios wraps the body in .data
}

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------
export const ApiGwAuthService = {
    register: (body) =>
        callBreaker(authBreaker, { method: "post", url: `${process.env.AUTH_SERVICE_URL}/register`, data: body }),

    login: (body) =>
        callBreaker(authBreaker, { method: "post", url: `${process.env.AUTH_SERVICE_URL}/login`, data: body }),

    logout: (body) =>
        callBreaker(authBreaker, { method: "post", url: `${process.env.AUTH_SERVICE_URL}/logout`, data: body }),
};

// ---------------------------------------------------------------------------
// Product Service
// ---------------------------------------------------------------------------
export const ApiGwProductService = {
    createProduct: (body, currentUser) =>
        callBreaker(productBreaker, { method: "post", url: `${process.env.PRODUCT_SERVICE_URL}/products`, data: body, headers: userHeader(currentUser) }),

    deleteProduct: (id, currentUser) =>
        callBreaker(productBreaker, { method: "delete", url: `${process.env.PRODUCT_SERVICE_URL}/products/${id}`, headers: userHeader(currentUser) }),

    updateProduct: (id, body, currentUser) =>
        callBreaker(productBreaker, { method: "put", url: `${process.env.PRODUCT_SERVICE_URL}/products/${id}`, data: body, headers: userHeader(currentUser) }),

    findProduct: (id, currentUser) =>
        callBreaker(productBreaker, { method: "get", url: `${process.env.PRODUCT_SERVICE_URL}/products/${id}`, headers: userHeader(currentUser) }),

    findAllProducts: (currentUser) =>
        callBreaker(productBreaker, { method: "get", url: `${process.env.PRODUCT_SERVICE_URL}/products`, headers: userHeader(currentUser) }),

    createCategory: (body, currentUser) =>
        callBreaker(productBreaker, { method: "post", url: `${process.env.PRODUCT_SERVICE_URL}/categories`, data: body, headers: userHeader(currentUser) }),

    deleteCategory: (id, currentUser) =>
        callBreaker(productBreaker, { method: "delete", url: `${process.env.PRODUCT_SERVICE_URL}/categories/${id}`, headers: userHeader(currentUser) }),

    updateCategory: (id, body, currentUser) =>
        callBreaker(productBreaker, { method: "put", url: `${process.env.PRODUCT_SERVICE_URL}/categories/${id}`, data: body, headers: userHeader(currentUser) }),

    findCategory: (id, currentUser) =>
        callBreaker(productBreaker, { method: "get", url: `${process.env.PRODUCT_SERVICE_URL}/categories/${id}`, headers: userHeader(currentUser) }),

    findAllCategories: (currentUser) =>
        callBreaker(productBreaker, { method: "get", url: `${process.env.PRODUCT_SERVICE_URL}/categories`, headers: userHeader(currentUser) }),
};

// ---------------------------------------------------------------------------
// Order Service
// ---------------------------------------------------------------------------
export const ApiGwOrderService = {
    createOrder: (body, currentUser) =>
        callBreaker(orderBreaker, { method: "post", url: `${process.env.ORDER_SERVICE_URL}/orders`, data: body, headers: userHeader(currentUser) }),

    deleteOrder: (id, currentUser) =>
        callBreaker(orderBreaker, { method: "delete", url: `${process.env.ORDER_SERVICE_URL}/orders/${id}`, headers: userHeader(currentUser) }),

    updateOrder: (id, body, currentUser) =>
        callBreaker(orderBreaker, { method: "put", url: `${process.env.ORDER_SERVICE_URL}/orders/${id}`, data: body, headers: userHeader(currentUser) }),

    findOrder: (id, currentUser) =>
        callBreaker(orderBreaker, { method: "get", url: `${process.env.ORDER_SERVICE_URL}/orders/${id}`, headers: userHeader(currentUser) }),

    findAllOrders: (currentUser, query) =>
        callBreaker(orderBreaker, { method: "get", url: `${process.env.ORDER_SERVICE_URL}/orders`, headers: userHeader(currentUser), params: query }),

    findOrdersForCustomer: (customerId, currentUser, query) =>
        callBreaker(orderBreaker, { method: "get", url: `${process.env.ORDER_SERVICE_URL}/orders/customer/${customerId}`, headers: userHeader(currentUser), params: query }),
};

// ---------------------------------------------------------------------------
// Notification Service
// ---------------------------------------------------------------------------
export const ApiGwNotificationService = {
    getMyNotifications: (currentUser, query) =>
        callBreaker(notifBreaker, { method: "get", url: `${process.env.NOTIFICATION_SERVICE_URL}/notifications-service/api/v1/notifications`, headers: userHeader(currentUser), params: query }),

    getNotificationById: (id, currentUser) =>
        callBreaker(notifBreaker, { method: "get", url: `${process.env.NOTIFICATION_SERVICE_URL}/notifications-service/api/v1/notifications/${id}`, headers: userHeader(currentUser) }),

    deleteNotification: (id, currentUser) =>
        callBreaker(notifBreaker, { method: "delete", url: `${process.env.NOTIFICATION_SERVICE_URL}/notifications-service/api/v1/notifications/${id}`, headers: userHeader(currentUser) }),
};

// ---------------------------------------------------------------------------
// Payment Service
// ---------------------------------------------------------------------------
export const ApiGwPaymentService = {
    createPayment: (body, currentUser) =>
        callBreaker(paymentBreaker, { method: "post", url: `${process.env.PAYMENT_SERVICE_URL}/`, data: body, headers: userHeader(currentUser) }),

    getMyPayments: (currentUser) =>
        callBreaker(paymentBreaker, { method: "get", url: `${process.env.PAYMENT_SERVICE_URL}/me`, headers: userHeader(currentUser) }),

    getPaymentsByOrder: (orderId, currentUser) =>
        callBreaker(paymentBreaker, { method: "get", url: `${process.env.PAYMENT_SERVICE_URL}/order/${orderId}`, headers: userHeader(currentUser) }),

    getPaymentById: (id, currentUser) =>
        callBreaker(paymentBreaker, { method: "get", url: `${process.env.PAYMENT_SERVICE_URL}/${id}`, headers: userHeader(currentUser) }),
};
