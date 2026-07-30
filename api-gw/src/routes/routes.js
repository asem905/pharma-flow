import express from "express";
import { authRoutes } from "./authroutes.js";
import { productsCategoriesRoutes } from "./productsCategoriesRoutes.js";
import verifyToken from "../middlewares/verifyToken.js";
const router = express.Router();

// Health check
router.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Public routes (no token needed)
router.use("/auth", authRoutes);

// Protected routes — verifyToken sets req.currentUser before hitting downstream
router.use("/", verifyToken, productsCategoriesRoutes);

// router.use("/payments", verifyToken, paymentsRoutes);

export default router;