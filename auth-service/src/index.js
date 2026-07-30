import express from "express";
import cors from "cors";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import bloomFilter from "./service/bloomFilterService.js";
import usersModel from "./model/usersModel.js";
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

    app.listen(process.env.PORT, () => {
        console.log(`Auth service running at : http://localhost:${process.env.PORT}/`);
    });
};

startServer();
