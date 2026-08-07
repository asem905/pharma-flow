import * as z from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const orderItemSchema = z.object({
    productId: z.string().uuid({ message: "productId must be a valid UUID" }),
    quantity: z.number().int().min(1, { message: "quantity must be at least 1" }),
    // price is NOT accepted from client — fetched from product-service via gRPC
});

const createOrderSchema = z.object({
    idempotencyKey: z.string().min(1, { message: "idempotencyKey is required" }),
    orderItems: z
        .array(orderItemSchema)
        .min(1, { message: "Order must contain at least one item" }),
});

// totalPrice is derived server-side (fetched from product-service, not trusted from client)

// Query params are always strings — use z.coerce to cast types
const orderQuerySchema = z.object({
    status: z
        .enum(["PENDING", "CONFIRMED", "CANCELLED", "PAYMENT_FAILURE"], {
            message: "status must be one of: PENDING, CONFIRMED, CANCELLED, PAYMENT_FAILURE",
        })
        .optional(),
    // ISO date strings e.g. 2024-01-15  →  coerced to Date objects
    fromDate: z.coerce.date({ message: "fromDate must be a valid ISO date (e.g. 2024-01-15)" }).optional(),
    toDate:   z.coerce.date({ message: "toDate must be a valid ISO date (e.g. 2024-01-15)" }).optional(),
}).refine(
    (data) => {
        if (data.fromDate && data.toDate) {
            return data.fromDate <= data.toDate;
        }
        return true;
    },
    { message: "fromDate must not be after toDate", path: ["fromDate"] }
);

// ─── Middleware ───────────────────────────────────────────────────────────────

const validateCreateOrder = (req, res, next) => {
    const result = createOrderSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues });
    }
    // Attach parsed & typed data to request
    req.validatedBody = result.data;
    next();
};

const validateOrderQuery = (req, res, next) => {
    const result = orderQuerySchema.safeParse(req.query);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues });
    }
    // Attach parsed & coerced query params (Date objects, not raw strings)
    req.validatedQuery = result.data;
    next();
};

export { validateCreateOrder, validateOrderQuery, createOrderSchema, orderItemSchema, orderQuerySchema };
