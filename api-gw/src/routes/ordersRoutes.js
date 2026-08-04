import express from "express";
import { apiGwOrderController } from "../controllers/apiGwControllers.js";

const ordersRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order lifecycle management
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: Order created — stock reserved, event published
 *       409:
 *         description: Insufficient stock or duplicate idempotency key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Product service unavailable
 */
ordersRoutes.post("/", apiGwOrderController.createOrder);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List all orders (ADMIN only)
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Array of all orders
 *       403:
 *         description: Forbidden
 */
ordersRoutes.get("/", apiGwOrderController.findAllOrders);

/**
 * @swagger
 * /orders/customer/{customerId}:
 *   get:
 *     summary: List orders for a specific customer
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer's user ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *         description: Filter by order status
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders from this date (ISO 8601)
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders up to this date (ISO 8601)
 *     responses:
 *       200:
 *         description: Array of customer orders
 *       403:
 *         description: CUSTOMER accessing another user's orders
 */
ordersRoutes.get("/customer/:customerId", apiGwOrderController.findOrdersForCustomer);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get a single order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
ordersRoutes.get("/:id", apiGwOrderController.findOrder);

/**
 * @swagger
 * /orders/{id}:
 *   put:
 *     summary: Update order status or items
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED]
 *               orderItems:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/OrderItemInput'
 *     responses:
 *       200:
 *         description: Order updated — stock adjusted, notification published
 *       404:
 *         description: Order not found
 *       409:
 *         description: Insufficient stock for updated items
 */
ordersRoutes.put("/:id", apiGwOrderController.updateOrder);

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Hard-delete an order (stock restored)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order deleted and stock restored via RabbitMQ
 *       404:
 *         description: Order not found
 */
ordersRoutes.delete("/:id", apiGwOrderController.deleteOrder);

export { ordersRoutes };