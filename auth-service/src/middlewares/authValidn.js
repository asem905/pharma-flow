import * as z from "zod";
import userRoles from "../utils/userRoles.js";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    confirm_password: z.string().min(6),
    full_name: z.string().min(6),
    phone: z.string().min(6),
    address: z.string().min(6),
    role: z.nativeEnum(userRoles),
});

const validateLogin = (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues });
    }
    next();
};

const validateRegister = (req, res, next) => {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues });
    }
    next();
};

export { validateLogin, validateRegister };
