import asyncHandler from "../middlewares/asyncWrapper.js"
import { PaymentService } from "../service/paymentService.js"
import appError from "../utils/appError.js";
const isAdmin = currentUser.role === "ADMIN";
export const createPayment = asyncHandler(async (req, res) => {
    const results = await PaymentService.createPayment({
        ...req.body,
        userId: req.currentUser.id,
    });
    if (results.statusCode) {
        return results;
    }
    res.status(201).json({
        status: "success",
        data: { results },
    });
});

export const getMyPayments = asyncHandler(async (req, res) => {
    if (req.currentUser?.id !== req.body.userId && req.currentUser?.role !== "ADMIN") {
        return appError.createErrorResponse("You are not authorized to perform this action", 401, "failure");
    }
    const results = await PaymentService.getMyPayments(req.currentUser.id);
    if (results.statusCode) {
        return results;
    }
    res.status(200).json({
        status: "success",
        data: { results },
    });
});

export const getPaymentsByOrder = asyncHandler(async (req, res) => {
    const results = await PaymentService.getPaymentsByOrder(
        req.params.orderId,
        req.currentUser
    );
    if (results.statusCode) {
        return results;
    }
    res.status(200).json({
        status: "success",
        data: { results },
    });
});

export const getPaymentById = asyncHandler(async (req, res) => {
    const results = await PaymentService.getPaymentById(
        req.params.id,
        req.currentUser
    );
    if (results.statusCode) {
        return results;
    }
    res.status(200).json({
        status: "success",
        data: { results },
    });
});