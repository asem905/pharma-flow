import { z } from "zod";
import appError from "../utils/appError.js";

const paymentBodySchema = z.object({
    orderId: z.string().uuid("Invalid order ID format"),
    amount: z.number().positive("Amount must be positive"),
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "VISA", "MASTERCARD"]),
    idempotencyKey: z.string().min(1, "Idempotency key is required"),
    currency: z.string().optional()
});

const paramIdSchema = z.object({
    orderId: z.string().uuid("Invalid order ID format").optional(),
    id: z.string().uuid("Invalid payment ID format").optional()
});

export const validatePaymentBody = (req, res, next) => {
    try {
        req.body = paymentBodySchema.parse(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(appError.createErrorResponse(error.errors.map(e => e.message).join(", "), 400, "failure"));
        }
        next(error);
    }
};

export const validateOrderId = (req, res, next) => {
    try {
        req.params.orderId = paramIdSchema.shape.orderId.parse(req.params.orderId);
        next();
    } catch (error) {
        return res.status(400).json(appError.createErrorResponse("Invalid order ID format", 400, "failure"));
    }
};

export const validatePaymentId = (req, res, next) => {
    try {
        req.params.id = paramIdSchema.shape.id.parse(req.params.id);
        next();
    } catch (error) {
        return res.status(400).json(appError.createErrorResponse("Invalid payment ID format", 400, "failure"));
    }
};
