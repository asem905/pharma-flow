import * as z from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// MongoDB ObjectId is a 24-character hex string
const objectIdSchema = z
    .string({ required_error: "id is required" })
    .regex(/^[a-f\d]{24}$/i, { message: "id must be a valid MongoDB ObjectId (24-char hex)" });

// ─── Schemas ──────────────────────────────────────────────────────────────────

// GET /notifications?cursor=<objectId>&limit=<number>
const getNotificationsQuerySchema = z.object({
    // cursor is the _id of the last doc seen — optional (absent on first page)
    cursor: objectIdSchema.optional(),

    // limit is a string from query params — coerce to number
    limit: z.coerce
        .number({ invalid_type_error: "limit must be a number" })
        .int({ message: "limit must be an integer" })
        .min(1,   { message: "limit must be at least 1" })
        .max(100, { message: "limit must not exceed 100" })
        .optional(),
});

// GET /notifications/:id  and  DELETE /notifications/:id
const notificationParamsSchema = z.object({
    id: objectIdSchema,
});

// ─── Middleware ───────────────────────────────────────────────────────────────

export const validateNotificationQuery = (req, res, next) => {
    const result = getNotificationsQuerySchema.safeParse(req.query);
    if (!result.success) {
        return res.status(400).json({ status: "fail", error: result.error.issues });
    }
    // Attach coerced, typed query values (limit is now a number, not a string)
    req.validatedQuery = result.data;
    next();
};

export const validateNotificationParams = (req, res, next) => {
    const result = notificationParamsSchema.safeParse(req.params);
    if (!result.success) {
        return res.status(400).json({ status: "fail", error: result.error.issues });
    }
    req.validatedParams = result.data;
    next();
};
