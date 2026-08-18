import express from "express";
import { apiGwNotificationController } from "../controllers/apiGwControllers.js";

const notificationsRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification inbox — cursor-paginated, newest first
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get my notifications (cursor-paginated)
 *     tags: [Notifications]
 *     description: |
 *       Returns the authenticated user's notifications, newest first.
 *       Uses **cursor-based pagination** (no skip — O(log n) index scan).
 *
 *       **First page:** call without `cursor`.
 *       **Next page:** pass the `nextCursor` value from the previous response as `?cursor=`.
 *       When `hasNextPage` is `false`, you have reached the end.
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           example: 66a1f2b3c4d5e6f7a8b9c0d1
 *         description: ObjectId of the last notification seen (omit for first page)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of notifications to return (max 100)
 *     responses:
 *       200:
 *         description: Paginated notification list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 hasNextPage:
 *                   type: boolean
 *                   example: true
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                   example: 66a1f2b3c4d5e6f7a8b9c0d1
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid cursor or limit value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationsRoutes.get("/", apiGwNotificationController.getMyNotifications);

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     summary: Get a single notification by ID
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 66a1f2b3c4d5e6f7a8b9c0d1
 *         description: MongoDB ObjectId of the notification
 *     responses:
 *       200:
 *         description: Notification found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid ObjectId format
 *       403:
 *         description: CUSTOMER accessing another user's notification
 *       404:
 *         description: Notification not found
 */
notificationsRoutes.get("/:id", apiGwNotificationController.getNotificationById);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 66a1f2b3c4d5e6f7a8b9c0d1
 *         description: MongoDB ObjectId of the notification
 *     responses:
 *       200:
 *         description: Notification deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Notification deleted
 *       400:
 *         description: Invalid ObjectId format
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Notification not found
 */
notificationsRoutes.delete("/:id", apiGwNotificationController.deleteNotification);

export { notificationsRoutes };
