import express from "express";
import { apiGwNotificationController } from "../controllers/apiGwControllers.js";

const notificationsRoutes = express.Router();

// GET  /notifications?page=1&limit=20  — my notifications (newest first)
notificationsRoutes.get("/", apiGwNotificationController.getMyNotifications);

// GET  /notifications/:id              — single notification
notificationsRoutes.get("/:id", apiGwNotificationController.getNotificationById);

// DELETE /notifications/:id            — delete a notification
notificationsRoutes.delete("/:id", apiGwNotificationController.deleteNotification);

export { notificationsRoutes };
