import asyncHandler from "../middlewares/asyncWrapper.js"
import { CategoryService } from "../service/categoryService.js"

export const createCategory = asyncHandler(async (req, res, next) => {
    const result = await CategoryService.createCategory(req.body);
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
export const deleteCategory = asyncHandler(async (req, res, next) => {
    const result = await CategoryService.deleteCategory(req.params.id);
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
export const updateCategory = asyncHandler(async (req, res, next) => {
    const result = await CategoryService.updateCategory(req.params.id, req.body);
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
export const findCategory = asyncHandler(async (req, res, next) => {
    const result = await CategoryService.findCategory(req.params.id);
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
export const findAllCategories = asyncHandler(async (req, res, next) => {
    const result = await CategoryService.findAllCategories();
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
