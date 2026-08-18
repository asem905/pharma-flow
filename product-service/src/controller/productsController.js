import asyncHandler from "../middlewares/asyncWrapper.js"
import { ProductsService } from "../service/productsService.js"

export const createProduct = asyncHandler(async (req, res, next) => {
    const result = await ProductsService.createProduct(req.body);
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
export const deleteProduct = asyncHandler(async (req, res, next) => {
    const result = await ProductsService.deleteProduct(req.params.id);
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
export const updateProduct = asyncHandler(async (req, res, next) => {
    const result = await ProductsService.updateProduct(req.params.id, req.body);
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
export const findProduct = asyncHandler(async (req, res, next) => {
    const result = await ProductsService.findProduct(req.params.id);
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
export const findAllProducts = asyncHandler(async (req, res, next) => {
    const result = await ProductsService.findAllProducts();
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
