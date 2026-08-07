import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import bloomFilter from "./service/bloomFilterService.js";
import usersModel from "./model/usersModel.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { startAuthConsumer } from "./events/authConsumer.js";
import { startAuthGrpcServer } from "./grpc/authGrpcServer.js";
dotenv.config();
const app = express();

app.use(cors({
    origin: process.env.APIGW_URL,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth-service/api/v1", router);

const startServer = async () => {
    const users = await usersModel.findAll({}, { email: true });
    const emails = users.map(u => u.email);
    console.log("Seeding bloom filter with emails:", emails);

    bloomFilter.initialize(emails);

    await connectRabbitMQ();
    await startAuthConsumer();
    
    // Start gRPC server
    startAuthGrpcServer();

    app.listen(process.env.PORT, () => {
        console.log(`Auth service running at : http://localhost:${process.env.PORT}/`);
    });
};

startServer();
