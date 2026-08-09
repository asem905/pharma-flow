import express from "express";
import { authRoutes } from "./authroutes.js";
import { productsCategoriesRoutes } from "./productsCategoriesRoutes.js";
import { ordersRoutes } from "./ordersRoutes.js";
import { notificationsRoutes } from "./notificationsRoutes.js";
import { paymentRoutes } from "./paymentRoutes.js";
import verifyToken from "../middlewares/verifyToken.js";
const router = express.Router();


// Public routes (no token needed)
router.use("/auth", authRoutes);

// Protected routes — verifyToken sets req.currentUser before hitting downstream
router.use("/", verifyToken, productsCategoriesRoutes);

router.use("/orders", verifyToken, ordersRoutes);

router.use("/notifications", verifyToken, notificationsRoutes);

router.use("/payments", verifyToken, paymentRoutes);

export default router;