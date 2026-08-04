import asyncHandler from "../middlewares/asyncWrapper.js"
import { PaymentService } from "../service/paymentService.js"
import appError from "../utils/appError.js";

// Singleton — instantiate once and reuse across all handlers
const paymentService = new PaymentService();

export const createPayment = asyncHandler(async (req, res) => {
    const results = await paymentService.createPayment({
        ...req.body,
        userId: req.currentUser.id,
        email: req.currentUser.email,   // threaded so service can publish events
    });
    if (results.statusCode) {
        return res.status(results.statusCode).json(results);
    }
    res.status(201).json({
        status: "success",
        data: { results },
    });
});

export const getMyPayments = asyncHandler(async (req, res) => {
    if (req.currentUser?.id !== req.body.userId && req.currentUser?.role !== "ADMIN") {
        return res.status(401).json(appError.createErrorResponse("You are not authorized to perform this action", 401, "failure"));
    }
    const results = await paymentService.getMyPayments(req.currentUser.id);
    if (results.statusCode) {
        return res.status(results.statusCode).json(results);
    }
    res.status(200).json({
        status: "success",
        data: { results },
    });
});

export const getPaymentsByOrder = asyncHandler(async (req, res) => {
    const results = await paymentService.getPaymentByOrderId(
        req.params.orderId,
        req.currentUser
    );
    if (results.statusCode) {
        return res.status(results.statusCode).json(results);
    }
    res.status(200).json({
        status: "success",
        data: { results },
    });
});

export const getPaymentById = asyncHandler(async (req, res) => {
    const results = await paymentService.getPaymentById(
        req.params.id,
        req.currentUser
    );
    if (results.statusCode) {
        return res.status(results.statusCode).json(results);
    }
    res.status(200).json({
        status: "success",
        data: { results },
    });
});