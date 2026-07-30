import userModel from "../model/usersModel.js"
import bcrypt from "bcrypt"
import appError from "../utils/appError.js"
import genJWT from "../utils/genJWT.js"
import bloomFilter from "./bloomFilterService.js"
export class AuthService {
    static async login(email, password) {
        // Bloom filter fast-path: if email is definitely not registered, skip DB entirely
        if (!bloomFilter.mightExistEmail(email)) {
            console.log("User not found from bloom filter")
            return appError.createErrorResponse("User not found", 404, "fail")
        }
        const user = await userModel.findByEmail(email)
        if (!user) {
            return appError.createErrorResponse("User not found", 404, "fail")
        }
        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
            return appError.createErrorResponse("Invalid credentials", 401, "fail")
        }

        const token = genJWT({ id: user.id, role: user.role })
        const { password: _, ...userWithoutPassword } = user
        return { token, user: userWithoutPassword }
    }
    static async register(full_name, email, password, confirm_password, phone, address, role) {
        const user = await userModel.findByEmail(email)
        if (user) {
            return appError.createErrorResponse("User already exists", 400, "fail")
        }
        if (password !== confirm_password) {
            return appError.createErrorResponse("Passwords do not match", 400, "fail")
        }
        const hashedPassword = await bcrypt.hash(password, 12)

        const newUser = await userModel.create({
            full_name,
            email,
            password: hashedPassword,
            phone,
            address,
            role
        })

        // Add to bloom filter so future login attempts for this email hit the DB
        bloomFilter.addEmail(email)

        const token = genJWT({ id: newUser.id, role: newUser.role })
        const { password: _, ...userWithoutPassword } = newUser
        return { token, user: userWithoutPassword }
    }
    static async updateAccount(id, full_name, email, password, confirm_password, phone, address, role) {
        const user = await userModel.findById(id)
        if (!user) {
            return appError.createErrorResponse("User not found", 404, "fail")
        }
        if (password !== confirm_password) {
            return appError.createErrorResponse("Passwords do not match", 400, "fail")
        }
        const hashedPassword = await bcrypt.hash(password, 12)
        const updatedUser = await userModel.update(id, {
            full_name,
            email,
            password: hashedPassword,
            phone,
            address,
            role
        })
        const { password: _, ...userWithoutPassword } = updatedUser
        return userWithoutPassword
    }
    static async deleteAccount(id) {
        const user = await userModel.findById(id)
        if (!user) {
            return appError.createErrorResponse("User not found", 404, "fail")
        }
        await userModel.delete(id)
        const { password: _, ...userWithoutPassword } = user
        return userWithoutPassword
    }
    static async getAllUsers() {
        const users = await userModel.findAll()
        return users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
    }
}