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
                res.status(error.response.status).json(error.response.data);
            });
    }
    login(req, res, next) {
        axios.post(`${process.env.AUTH_SERVICE_URL}/login`, req.body)
            .then(response => {
                res.json(response.data);
            })
            .catch(error => {
                res.status(error.response.status).json(error.response.data);
            });
    }

    logout(req, res, next) {
        axios.post(`${process.env.AUTH_SERVICE_URL}/logout`, req.body)
            .then(response => {
                res.json(response.data);
            })
            .catch(error => {
                res.status(error.response.status).json(error.response.data);
            });
    }
}

class ApiGwProductController {
    createProduct(req, res, next) {
        axios.post(`${process.env.PRODUCT_SERVICE_URL}/products`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    deleteProduct(req, res, next) {
        axios.delete(`${process.env.PRODUCT_SERVICE_URL}/products/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    updateProduct(req, res, next) {
        axios.put(`${process.env.PRODUCT_SERVICE_URL}/products/${req.params.id}`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    findProduct(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/products/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    findAllProducts(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/products`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    createCategory(req, res, next) {
        axios.post(`${process.env.PRODUCT_SERVICE_URL}/categories`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    deleteCategory(req, res, next) {
        axios.delete(`${process.env.PRODUCT_SERVICE_URL}/categories/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    updateCategory(req, res, next) {
        axios.put(`${process.env.PRODUCT_SERVICE_URL}/categories/${req.params.id}`, req.body, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    findCategory(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/categories/${req.params.id}`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
    findAllCategories(req, res, next) {
        axios.get(`${process.env.PRODUCT_SERVICE_URL}/categories`, {
            headers: forwardUserHeader(req.currentUser)
        })
            .then(response => { res.json(response.data); })
            .catch(error => { res.status(error.response.status).json(error.response.data); });
    }
}

const apiGwAuthController = new ApiGwAuthController();
const apiGwProductController = new ApiGwProductController();
export { apiGwAuthController, apiGwProductController };