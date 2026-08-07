import axios from "axios";

// Helper: build headers that forward the decoded user to downstream services
// The product service reads req.currentUser from this header
const forwardUserHeader = (currentUser) => ({
    "x-current-user": JSON.stringify(currentUser)
});

class ApiGwAuthController {
    register(req, res, next) {
        axios.post(`${process.env.AUTH_SERVICE_URL}/register`, req.body)
            .then(response => {
                res.json(response.data);
            })
            .catch(error => {
                res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" });
            });
    }
    login(req, res, next) {
        axios.post(`${process.env.AUTH_SERVICE_URL}/login`, req.body)
            .then(response => {
                res.json(response.data);
            })
            .catch(error => {
                res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" });
            });
    }

    logout(req, res, next) {
        axios.post(`${process.env.AUTH_SERVICE_URL}/logout`, req.body)
            .then(response => {
                res.json(response.data);
            })
            .catch(error => {
                res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" });
            });
    }
}

class ApiGwProductController {
    createProduct(req, res, next) {
        axios.post(`${process.env.PRODUCT_SERVICE_URL}/products`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    deleteProduct(req, res, next) {
        axios.delete(`${process.env.PRODUCT_SERVICE_URL}/products/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    updateProduct(req, res, next) {
        axios.put(`${process.env.PRODUCT_SERVICE_URL}/products/${req.params.id}`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findProduct(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/products/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findAllProducts(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/products`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    createCategory(req, res, next) {
        axios.post(`${process.env.PRODUCT_SERVICE_URL}/categories`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    deleteCategory(req, res, next) {
        axios.delete(`${process.env.PRODUCT_SERVICE_URL}/categories/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    updateCategory(req, res, next) {
        axios.put(`${process.env.PRODUCT_SERVICE_URL}/categories/${req.params.id}`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findCategory(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/categories/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findAllCategories(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/categories`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
}

class ApiGwOrderController {
    createOrder(req, res, next) {
        axios.post(`${process.env.ORDER_SERVICE_URL}/orders`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    deleteOrder(req, res, next) {
        axios.delete(`${process.env.ORDER_SERVICE_URL}/orders/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    updateOrder(req, res, next) {
        axios.put(`${process.env.ORDER_SERVICE_URL}/orders/${req.params.id}`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findOrder(req, res, next) {
        axios.get(`${process.env.ORDER_SERVICE_URL}/orders/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findAllOrders(req, res, next) {
        axios.get(`${process.env.ORDER_SERVICE_URL}/orders`, {
            headers: forwardUserHeader(req.currentUser),
            params: req.query
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    findOrdersForCustomer(req, res, next) {
        axios.get(`${process.env.ORDER_SERVICE_URL}/orders/customer/${req.params.customerId}`, {
            headers: forwardUserHeader(req.currentUser),
            params: req.query
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
}

const apiGwAuthController = new ApiGwAuthController();
const apiGwProductController = new ApiGwProductController();
const apiGwOrderController = new ApiGwOrderController();

class ApiGwNotificationController {
    getMyNotifications(req, res, next) {
        axios.get(`${process.env.NOTIFICATION_SERVICE_URL}/notifications-service/api/v1/notifications`, {
            headers: forwardUserHeader(req.currentUser),
            params: req.query, // forward ?page & ?limit
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    getNotificationById(req, res, next) {
        axios.get(`${process.env.NOTIFICATION_SERVICE_URL}/notifications-service/api/v1/notifications/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser),
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    deleteNotification(req, res, next) {
        axios.delete(`${process.env.NOTIFICATION_SERVICE_URL}/notifications-service/api/v1/notifications/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser),
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
}

const apiGwNotificationController = new ApiGwNotificationController();

class ApiGwPaymentController {
    createPayment(req, res, next) {
        axios.post(`${process.env.PAYMENT_SERVICE_URL}/`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    getMyPayments(req, res, next) {
        axios.get(`${process.env.PAYMENT_SERVICE_URL}/me`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    getPaymentsByOrder(req, res, next) {
        axios.get(`${process.env.PAYMENT_SERVICE_URL}/order/${req.params.orderId}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
    getPaymentById(req, res, next) {
        axios.get(`${process.env.PAYMENT_SERVICE_URL}/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal Server Error" }); });
    }
}

const apiGwPaymentController = new ApiGwPaymentController();

export { apiGwAuthController, apiGwProductController, apiGwOrderController, apiGwNotificationController, apiGwPaymentController };