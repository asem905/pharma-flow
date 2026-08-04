import express from "express";
import { apiGwPaymentController } from "../controllers/apiGwControllers.js";

const paymentRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and retrieval
 */

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Create a payment for an order
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH_ON_DELIVERY, VISA, MASTERCARD]
 *               idempotencyKey:
 *                 type: string
 *               currency:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment processed successfully
 *       400:
 *         description: Validation error or Order not in pending state
 *       403:
 *         description: Not authorized to create payment for this order
 *       404:
 *         description: Order not found
 */
paymentRoutes.post("/", apiGwPaymentController.createPayment);

/**
 * @swagger
 * /payments/me:
 *   get:
 *     summary: List all payments for the logged-in user
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: A list of payments
 */
paymentRoutes.get("/me", apiGwPaymentController.getMyPayments);

/**
 * @swagger
 * /payments/order/{orderId}:
 *   get:
 *     summary: List all payments for a specific order
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of payments for the order
 *       403:
 *         description: Not authorized to view this payment
 *       404:
 *         description: Order not found
 */
paymentRoutes.get("/order/:orderId", apiGwPaymentController.getPaymentsByOrder);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get a single payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 *       403:
 *         description: Not authorized to view this payment
 *       404:
 *         description: Payment not found
 */
paymentRoutes.get("/:id", apiGwPaymentController.getPaymentById);

export { paymentRoutes };
