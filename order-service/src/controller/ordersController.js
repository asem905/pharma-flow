import asyncHandler from "../middlewares/asyncWrapper.js"
import { OrdersService } from "../service/ordersService.js"
import appError from "../utils/appError.js";

export const createOrder = asyncHandler(async (req, res, next) => {
    const userId = req.currentUser.id;
    const result = await OrdersService.createOrder(req.validatedBody, userId);
    if (result.statusCode) {
        return res.status(result.statusCode).json({
            status: "fail",
            message: result.message
        })
    }
    res.status(201).json({
        status: "success",
        data: result
    })
})

export const deleteOrder = asyncHandler(async (req, res, next) => {
    const orderId = req.params.id;
    const result = await OrdersService.deleteOrder(orderId);
    if (result.statusCode) {
        return res.status(result.statusCode).json({
            status: "fail",
            message: result.message
        })
    }
    res.status(200).json({
        status: "success",
        data: result
    })
})

export const updateOrder = asyncHandler(async (req, res, next) => {
    const orderId = req.params.id;
    const result = await OrdersService.updateOrder(orderId, req.body);
    if (result.statusCode) {
        return res.status(result.statusCode).json({
            status: "fail",
            message: result.message
        })
    }
    res.status(200).json({
        status: "success",
        data: result
    })
})

export const findOrder = asyncHandler(async (req, res, next) => {
    const orderId = req.params.id;
    const result = await OrdersService.findOrder(orderId);
    if (result.statusCode) {
        return res.status(result.statusCode).json({
            status: "fail",
            message: result.message
        })
    }
    res.status(200).json({
        status: "success",
        data: result
    })
})

export const findAllOrders = asyncHandler(async (req, res, next) => {
    const result = await OrdersService.findAllOrders();
    if (result.statusCode) {
        return res.status(result.statusCode).json({
            status: "fail",
            message: result.message
        })
    }
    res.status(200).json({
        status: "success",
        data: result
    })
})

export const findOrdersForCustomer = asyncHandler(async (req, res, next) => {
    // req.validatedQuery is set by validateOrderQuery middleware
    // it contains coerced types: { status?, fromDate?: Date, toDate?: Date }
    const userId = req.currentUser.id;
    console.log("==================================", req.currentUser.role, req.params.id);
    if (req.currentUser.role === "CUSTOMER") {
        if (userId !== req.params.id) {
            return next(appError.createErrorResponse("You are not authorized to access this resource", 403));
        }
    }
    const result = await OrdersService.findOrdersForCustomer(req.params.id, req.validatedQuery);
    if (result.statusCode) {
        return res.status(result.statusCode).json({
            status: "fail",
            message: result.message
        })
    }
    res.status(200).json({
        status: "success",
        data: result
    })
})
