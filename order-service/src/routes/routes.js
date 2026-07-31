import express from "express";

import {
    createOrder,
    deleteOrder,
    updateOrder,
    findOrder,
    findAllOrders,
    findOrdersForCustomer,
} from "../controller/ordersController.js";
import { validateRole } from "../middlewares/validateRole.js";
import { validateCreateOrder, validateOrderQuery } from "../middlewares/orderValidation.js";

const router = express.Router();

router.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

router.post("/orders", validateRole("ADMIN", "CUSTOMER"), validateCreateOrder, createOrder);
router.delete("/orders/:id", validateRole("ADMIN", "CUSTOMER"), deleteOrder);
router.put("/orders/:id", validateRole("ADMIN", "CUSTOMER"), updateOrder);
// IMPORTANT: /orders/customer/:customerId MUST come before /orders/:id
// Otherwise Express matches "customer" as the :id param value
router.get("/orders/customer/:customerId", validateRole("CUSTOMER"), validateOrderQuery, findOrdersForCustomer);
router.get("/orders/:id", validateRole("ADMIN", "CUSTOMER"), findOrder);
router.get("/orders", validateRole("ADMIN"), findAllOrders);

export default router;