import express from "express";
import axios from "axios";
const authRoutes = express.Router();

authRoutes.post("/register", (req, res) => {
    console.log("Register request received");
    axios.post(`${process.env.AUTH_SERVICE_URL}/register`, req.body)
        .then(response => {
            res.json(response.data);
        })
        .catch(error => {
            res.status(error.response.status).json(error.response.data);
        });
});

authRoutes.post("/login", (req, res) => {
    res.json({ message: "Login" });
});


export { authRoutes };