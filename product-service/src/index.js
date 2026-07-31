import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import extractCurrentUser from "./middlewares/extractCurrentUser.js";
import { startGrpcServer } from "./grpc/productGrpcServer.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { startStockConsumer } from "./events/stockConsumer.js";
dotenv.config();
const app = express();

app.use(cors({
    origin: process.env.APIGW_URL,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractCurrentUser);

app.use("/product-service/api/v1", router);

const startServer = async () => {
    // Connect to RabbitMQ and start consuming events before serving traffic
    await connectRabbitMQ();
    await startStockConsumer();

    // Start HTTP server
    app.listen(process.env.PORT, () => {
        console.log(`Product service running at : http://localhost:${process.env.PORT}/`);
    });

    // Start gRPC server (internal service-to-service communication)
    startGrpcServer();
};

startServer();
