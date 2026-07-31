import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import extractCurrentUser from "./middlewares/extractCurrentUser.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
dotenv.config();
const app = express();

app.use(cors({
    origin: process.env.APIGW_URL,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractCurrentUser);

app.use("/order-service/api/v1", router);

const startServer = async () => {
    await connectRabbitMQ();

    app.listen(process.env.PORT, () => {
        console.log(`Order service running at : http://localhost:${process.env.PORT}/`);
    });
};

startServer();
