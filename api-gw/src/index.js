import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import router from "./routes/routes.js";
import dotenv from "dotenv";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";

dotenv.config();
const app = express();

// ── Swagger UI — served before helmet so CSP doesn't block it ─────────────────
app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: "PharmaFlow API Docs",
        swaggerOptions: {
            persistAuthorization: true, // keeps the JWT filled in across page refreshes
        },
    })
);

// Expose raw OpenAPI JSON for tools like Postman / Insomnia
app.get("/api/v1/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

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
    console.log(`API Gateway running at      : http://localhost:${process.env.PORT}/api/v1`);
    console.log(`Swagger UI available at     : http://localhost:${process.env.PORT}/api/v1/docs`);
    console.log(`OpenAPI JSON available at   : http://localhost:${process.env.PORT}/api/v1/docs.json`);
});
