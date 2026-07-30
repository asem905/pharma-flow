import axios from "axios";

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
const apiGwAuthController = new ApiGwAuthController();
export { apiGwAuthController };    