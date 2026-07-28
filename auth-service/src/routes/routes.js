import express from "express";
const router = express.Router();


router.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

router.post('/login', (req, res) => {
    console.log("Auth Service : Login request received");
    res.json({ message: 'Login' });
});

router.post('/register', (req, res) => {
    console.log("Auth Service : Register request received");
    res.json({ message: 'Register' });
});

export default router;