import asyncHandler from "../middlewares/asyncWrapper.js"
import { AuthService } from "../service/authService.js"


const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body
    const response = await AuthService.login(email, password)
    if (response.statusCode) {
        return res.status(response.statusCode).json(response)
    }
    return res.status(200).json(response)
})
const register = asyncHandler(async (req, res, next) => {
    const { full_name, email, password, confirm_password, phone, address, role } = req.body
    const response = await AuthService.register(full_name, email, password, confirm_password, phone, address, role)
    if (response.statusCode) {
        return res.status(response.statusCode).json(response)
    }
    return res.status(200).json(response)
})
const updateAccount = asyncHandler(async (req, res, next) => {
    const { id, full_name, email, password, confirm_password, phone, address, role } = req.body
    const response = await AuthService.updateAccount(id, full_name, email, password, confirm_password, phone, address, role)
    if (response.statusCode) {
        return res.status(response.statusCode).json(response)
    }
    return res.status(200).json(response)
})
const deleteAccount = asyncHandler(async (req, res, next) => {
    const { id } = req.body
    const response = await AuthService.deleteAccount(id)
    if (response.statusCode) {
        return res.status(response.statusCode).json(response)
    }
    return res.status(200).json(response)
})
const getAllUsers = asyncHandler(async (req, res, next) => {
    const response = await AuthService.getAllUsers()
    if (response.statusCode) {
        return res.status(response.statusCode).json(response)
    }
    return res.status(200).json(response)
})
export { login, register, updateAccount, deleteAccount, getAllUsers }