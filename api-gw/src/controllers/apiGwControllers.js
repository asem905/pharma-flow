import {
    ApiGwAuthService,
    ApiGwProductService,
    ApiGwOrderService,
    ApiGwNotificationService,
    ApiGwPaymentService,
} from "../services/apiGwService.js";

// ---------------------------------------------------------------------------
// Shared response handler
// Downstream 4xx/5xx errors are forwarded as-is via axios interceptor.
// Circuit-open 503s come through the same path (thrown in callBreaker).
// ---------------------------------------------------------------------------
const handle = (serviceCall, res, next) => {
    serviceCall
        .then((data) => res.json(data))
        .catch((err) => {
            // axios HTTP errors carry the real downstream status + body
            if (err.response) {
                return res.status(err.response.status).json(err.response.data);
            }
            // Circuit breaker fast-fail (503) or network-level errors
            res.status(err.statusCode || 500).json({ message: err.message || "Internal Server Error" });
        });
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
class ApiGwAuthController {
    register(req, res, next)  { handle(ApiGwAuthService.register(req.body), res, next); }
    login(req, res, next)     { handle(ApiGwAuthService.login(req.body), res, next); }
    logout(req, res, next)    { handle(ApiGwAuthService.logout(req.body), res, next); }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
class ApiGwProductController {
    createProduct(req, res, next)    { handle(ApiGwProductService.createProduct(req.body, req.currentUser), res, next); }
    deleteProduct(req, res, next)    { handle(ApiGwProductService.deleteProduct(req.params.id, req.currentUser), res, next); }
    updateProduct(req, res, next)    { handle(ApiGwProductService.updateProduct(req.params.id, req.body, req.currentUser), res, next); }
    findProduct(req, res, next)      { handle(ApiGwProductService.findProduct(req.params.id, req.currentUser), res, next); }
    findAllProducts(req, res, next)  { handle(ApiGwProductService.findAllProducts(req.currentUser), res, next); }
    createCategory(req, res, next)   { handle(ApiGwProductService.createCategory(req.body, req.currentUser), res, next); }
    deleteCategory(req, res, next)   { handle(ApiGwProductService.deleteCategory(req.params.id, req.currentUser), res, next); }
    updateCategory(req, res, next)   { handle(ApiGwProductService.updateCategory(req.params.id, req.body, req.currentUser), res, next); }
    findCategory(req, res, next)     { handle(ApiGwProductService.findCategory(req.params.id, req.currentUser), res, next); }
    findAllCategories(req, res, next){ handle(ApiGwProductService.findAllCategories(req.currentUser), res, next); }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
class ApiGwOrderController {
    createOrder(req, res, next)           { handle(ApiGwOrderService.createOrder(req.body, req.currentUser), res, next); }
    deleteOrder(req, res, next)           { handle(ApiGwOrderService.deleteOrder(req.params.id, req.currentUser), res, next); }
    updateOrder(req, res, next)           { handle(ApiGwOrderService.updateOrder(req.params.id, req.body, req.currentUser), res, next); }
    findOrder(req, res, next)             { handle(ApiGwOrderService.findOrder(req.params.id, req.currentUser), res, next); }
    findAllOrders(req, res, next)         { handle(ApiGwOrderService.findAllOrders(req.currentUser, req.query), res, next); }
    findOrdersForCustomer(req, res, next) { handle(ApiGwOrderService.findOrdersForCustomer(req.params.customerId, req.currentUser, req.query), res, next); }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
class ApiGwNotificationController {
    getMyNotifications(req, res, next)  { handle(ApiGwNotificationService.getMyNotifications(req.currentUser, req.query), res, next); }
    getNotificationById(req, res, next) { handle(ApiGwNotificationService.getNotificationById(req.params.id, req.currentUser), res, next); }
    deleteNotification(req, res, next)  { handle(ApiGwNotificationService.deleteNotification(req.params.id, req.currentUser), res, next); }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
class ApiGwPaymentController {
    createPayment(req, res, next)     { handle(ApiGwPaymentService.createPayment(req.body, req.currentUser), res, next); }
    getMyPayments(req, res, next)     { handle(ApiGwPaymentService.getMyPayments(req.currentUser), res, next); }
    getPaymentsByOrder(req, res, next){ handle(ApiGwPaymentService.getPaymentsByOrder(req.params.orderId, req.currentUser), res, next); }
    getPaymentById(req, res, next)    { handle(ApiGwPaymentService.getPaymentById(req.params.id, req.currentUser), res, next); }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
const apiGwAuthController         = new ApiGwAuthController();
const apiGwProductController      = new ApiGwProductController();
const apiGwOrderController        = new ApiGwOrderController();
const apiGwNotificationController = new ApiGwNotificationController();
const apiGwPaymentController      = new ApiGwPaymentController();

export {
    apiGwAuthController,
    apiGwProductController,
    apiGwOrderController,
    apiGwNotificationController,
    apiGwPaymentController,
};