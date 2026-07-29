import express from "express";
import { validateLogin, validateRegister } from "../middlewares/authValidn.js"
import { login, register, updateAccount, deleteAccount, getAllUsers } from "../controller/authController.js";

const router = express.Router();

router.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

router.post('/login', validateLogin, login);
router.post('/register', validateRegister, register);

// In a real app, these should probably be protected by an authentication middleware
router.put('/update', updateAccount);
router.delete('/delete', deleteAccount);
router.get('/users', getAllUsers);

export default router;