import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { startRefundSweep } from "./jobs/refundSweep.js";
dotenv.config();
const app = express();

app.use(cors({
    origin: process.env.APIGW_URL,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/payment-service/api/v1", router);

const startServer = async () => {
    await connectRabbitMQ();   // must be ready before any payment publish calls
    startRefundSweep();        // background cron — catches any PENDING refunds the RPC missed

    app.listen(process.env.PORT, () => {
        console.log(`payment service running at : http://localhost:${process.env.PORT}/`);
    });
};

startServer();
