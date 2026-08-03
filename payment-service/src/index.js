import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
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
    app.listen(process.env.PORT, () => {
        console.log(`payment service running at : http://localhost:${process.env.PORT}/`);
    });
};

startServer();
