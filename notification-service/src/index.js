import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import { startNotificationConsumer } from './events/notificationConsumer.js';
import notificationRoutes from './routes/notificationRoutes.js';
const app = express();
app.use(cors());
app.use(express.json());


app.use('/notifications-service/api/v1', notificationRoutes);

const PORT = process.env.PORT;

const start = async () => {
    await connectDB();
    await connectRabbitMQ();
    await startNotificationConsumer();

    app.get("/health", (req, res) => {
        res.status(200).json({ status: "UP", service: "notification-service", uptime: process.uptime() });
    });

    app.listen(PORT, () => {
        console.log(`[Server] Notification service running at http://localhost:${PORT}`);
    });
};

start();
