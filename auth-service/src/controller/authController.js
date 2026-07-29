import asyncHandler from "../middlewares/asyncWrapper.js"
import { AuthService } from "../service/authService.js"


const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body

    const { token, user } = await AuthService.login(email, password)

    return res.status(200).json({ token, user })
})
const register = asyncHandler(async (req, res, next) => {
    const { full_name, email, password, confirm_password, phone, address, role } = req.body

    const { token, user } = await AuthService.register(full_name, email, password, confirm_password, phone, address, role)

    return res.status(200).json({ token, user })

})
const updateAccount = asyncHandler(async (req, res, next) => {
    const { id, full_name, email, password, confirm_password, phone, address, role } = req.body
    const updatedUser = await AuthService.updateAccount(id, full_name, email, password, confirm_password, phone, address, role)
    return res.status(200).json({ updatedUser })
})
const deleteAccount = asyncHandler(async (req, res, next) => {
    const { id } = req.body
    const deletedUser = await AuthService.deleteAccount(id)
    return res.status(200).json({ deletedUser })
})
const getAllUsers = asyncHandler(async (req, res, next) => {
    const users = await AuthService.getAllUsers()
    return res.status(200).json({ users })
})
export { login, register, updateAccount, deleteAccount, getAllUsers }