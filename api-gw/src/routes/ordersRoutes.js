import express from "express";
import { apiGwOrderController } from "../controllers/apiGwControllers.js";

const ordersRoutes = express.Router();

ordersRoutes.post("/", apiGwOrderController.createOrder);
ordersRoutes.delete("/:id", apiGwOrderController.deleteOrder);
ordersRoutes.put("/:id", apiGwOrderController.updateOrder);
ordersRoutes.get("/customer/:customerId", apiGwOrderController.findOrdersForCustomer);
ordersRoutes.get("/:id", apiGwOrderController.findOrder);
ordersRoutes.get("/", apiGwOrderController.findAllOrders);

export { ordersRoutes };