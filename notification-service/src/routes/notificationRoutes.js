import express from "express";
import extractCurrentUser from "../middlewares/extractCurrentUser.js";
import { validateNotificationQuery, validateNotificationParams } from "../middlewares/notificationValidation.js";
import {
    getMyNotifications,
    getNotificationById,
    deleteNotification,
} from "../controller/notificationController.js";

const router = express.Router();

// All routes below require a valid user header from the API gateway
router.use(extractCurrentUser);

// GET  /notifications-service/api/v1/notifications?page=1&limit=20
// Returns paginated notifications for the logged-in user, newest first
router.get("/notifications", validateNotificationQuery, getMyNotifications);

// GET  /notifications-service/api/v1/notifications/:id
router.get("/notifications/:id", validateNotificationParams, getNotificationById);

// DELETE /notifications-service/api/v1/notifications/:id
router.delete("/notifications/:id", validateNotificationParams, deleteNotification);

export default router;
