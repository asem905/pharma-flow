import express from "express";
import extractCurrentUser from "../middlewares/extractCurrentUser.js";
import { validatePaymentBody, validateOrderId, validatePaymentId } from "../middlewares/paymentValidation.js";
import { createPayment, getMyPayments, getPaymentsByOrder, getPaymentById } from "../controller/paymentController.js";
const router = express.Router();

router.post(
    "/",
    extractCurrentUser,
    validatePaymentBody,
    createPayment
);

router.get(
    "/me",
    extractCurrentUser,
    getMyPayments
);

router.get(
    "/order/:orderId",
    extractCurrentUser,
    validateOrderId,
    getPaymentsByOrder
);

router.get(
    "/:id",
    extractCurrentUser,
    validatePaymentId,
    getPaymentById
);

export default router