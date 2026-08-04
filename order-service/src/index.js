import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import extractCurrentUser from "./middlewares/extractCurrentUser.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { startGrpcServer } from "./grpc/orderGrpcServer.js";
import { startOrderConsumer } from "./events/orderConsumer.js";
dotenv.config();
const app = express();

const allowedOrigins = [
    process.env.APIGW_URL,
    "http://localhost:5173",
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractCurrentUser);

app.use("/order-service/api/v1", router);

const startServer = async () => {
    await connectRabbitMQ();
    await startOrderConsumer();   // listen for payment.success / payment.failed
    startGrpcServer();

    app.listen(process.env.PORT, () => {
        console.log(`Order service running at : http://localhost:${process.env.PORT}/`);
    });
};

startServer();
