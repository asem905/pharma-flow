import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import helmet from "helmet";
dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({
    origin: "*",
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again after 5 minutes",
});

app.use("/", apiLimiter);
app.use("/api/v1", router);

app.listen(process.env.PORT, () => {
    console.log(`API Gateway running at : http://localhost:${process.env.PORT}/api/v1`);
});
