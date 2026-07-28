import express from "express";
import { authRoutes } from "./authroutes.js";
// import paymentRoutes from "./paymentRoutes";
const router = express.Router();

// Health check
router.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Proxy routes
router.use("/auth", authRoutes);

// router.use("/payments", paymentRoutes);

export default router;