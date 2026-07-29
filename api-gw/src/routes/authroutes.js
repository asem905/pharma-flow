import express from "express";
import { apiGwAuthController } from "../controllers/apiGwControllers.js";
const authRoutes = express.Router();

authRoutes.post("/register", apiGwAuthController.register);

authRoutes.post("/login", apiGwAuthController.login);


export { authRoutes };