import asyncHandler from "../middlewares/asyncWrapper.js";
import { NotificationService } from "../service/notificationService.js";

// GET /notifications-service/api/v1/notifications?cursor=<lastId>&limit=20
// Cursor-based: pass `cursor` = _id of the last doc from the previous response
export const getMyNotifications = asyncHandler(async (req, res) => {
    const email = req.currentUser.email;
    const { cursor, limit } = req.validatedQuery;

    const result = await NotificationService.getByEmail(email, { cursor, limit });

    res.status(200).json({
        status: "success",
        hasNextPage: result.hasNextPage,
        nextCursor: result.nextCursor,   // pass this as ?cursor= in your next request
        data: result.notifications,
    });
});

// GET /notifications-service/api/v1/notifications/:id
export const getNotificationById = asyncHandler(async (req, res) => {
    const notification = await NotificationService.getById(req.validatedParams.id);

    if (!notification) {
        return res.status(404).json({ status: "fail", message: "Notification not found" });
    }

    // CUSTOMER can only read their own notification
    if (req.currentUser.role === "CUSTOMER" && notification.email !== req.currentUser.email) {
        return res.status(403).json({ status: "fail", message: "Forbidden" });
    }

    res.status(200).json({ status: "success", data: notification });
});

// DELETE /notifications-service/api/v1/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await NotificationService.getById(req.validatedParams.id);

    if (!notification) {
        return res.status(404).json({ status: "fail", message: "Notification not found" });
    }

    // CUSTOMER can only delete their own notification
    if (req.currentUser.role === "CUSTOMER" && notification.email !== req.currentUser.email) {
        return res.status(403).json({ status: "fail", message: "Forbidden" });
    }

    await NotificationService.deleteById(req.validatedParams.id);
    res.status(200).json({ status: "success", message: "Notification deleted" });
});
