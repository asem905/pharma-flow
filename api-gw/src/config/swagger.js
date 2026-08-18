import swaggerJsdoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "PharmaFlow API",
            version: "1.0.0",
            description:
                "API Gateway documentation for the PharmaFlow microservices platform. " +
                "All protected endpoints require a Bearer JWT token obtained from `/api/v1/auth/login`. " +
                "The system is built with circuit breakers (opossum) for resilience against downstream failures and centralized structured logging (Winston + RabbitMQ + Loki) for full observability.",
        },
        servers: [
            { url: "http://localhost:3000/api/v1", description: "Local development" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                // ── Auth ──────────────────────────────────────────────────────
                RegisterRequest: {
                    type: "object",
                    required: ["full_name", "email", "password", "confirm_password", "role"],
                    properties: {
                        full_name:        { type: "string",  example: "John Doe" },
                        email:            { type: "string",  format: "email", example: "john@pharma.com" },
                        password:         { type: "string",  format: "password", example: "Secret123!" },
                        confirm_password: { type: "string",  format: "password", example: "Secret123!" },
                        phone:            { type: "string",  example: "+201012345678" },
                        address:          { type: "string",  example: "123 Main St, Cairo" },
                        role:             { type: "string",  enum: ["ADMIN", "CUSTOMER"], example: "CUSTOMER" },
                    },
                },
                LoginRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email:    { type: "string", format: "email",    example: "john@pharma.com" },
                        password: { type: "string", format: "password", example: "Secret123!" },
                    },
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsIn..." },
                        user: {
                            type: "object",
                            properties: {
                                id:        { type: "string" },
                                full_name: { type: "string" },
                                email:     { type: "string" },
                                role:      { type: "string" },
                            },
                        },
                    },
                },

                // ── Product ───────────────────────────────────────────────────
                ProductRequest: {
                    type: "object",
                    required: ["name", "price", "stock", "categoryId"],
                    properties: {
                        name:        { type: "string",  example: "Paracetamol 500mg" },
                        description: { type: "string",  example: "Pain reliever" },
                        price:       { type: "number",  example: 12.50 },
                        stock:       { type: "integer", example: 200 },
                        categoryId:  { type: "string",  example: "clx1..." },
                    },
                },

                // ── Category ──────────────────────────────────────────────────
                CategoryRequest: {
                    type: "object",
                    required: ["name"],
                    properties: {
                        name:        { type: "string", example: "Analgesics" },
                        description: { type: "string", example: "Pain relief medications" },
                    },
                },

                // ── Order ─────────────────────────────────────────────────────
                OrderItemInput: {
                    type: "object",
                    required: ["productId", "quantity"],
                    properties: {
                        productId: { type: "string", format: "uuid", example: "a1b2c3d4-..." },
                        quantity:  { type: "integer", minimum: 1,    example: 2 },
                    },
                },
                CreateOrderRequest: {
                    type: "object",
                    required: ["idempotencyKey", "orderItems"],
                    properties: {
                        idempotencyKey: { type: "string", example: "user-123-ts-1700000000" },
                        orderItems: {
                            type: "array",
                            items: { $ref: "#/components/schemas/OrderItemInput" },
                        },
                    },
                },

                // ── Notification ──────────────────────────────────────────────
                Notification: {
                    type: "object",
                    properties: {
                        _id:       { type: "string", example: "66a1f2b3c4d5e6f7a8b9c0d1" },
                        email:     { type: "string", example: "john@pharma.com" },
                        type:      { type: "string", enum: ["ORDER_PLACED","ORDER_CANCELLED","ORDER_UPDATED","GENERAL"] },
                        title:     { type: "string", example: "Order Placed Successfully" },
                        message:   { type: "string", example: "Your order #xyz has been placed." },
                        payload:   { type: "object" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },

                // ── Payment ───────────────────────────────────────────────────
                PaymentRequest: {
                    type: "object",
                    required: ["orderId", "amount", "paymentMethod", "idempotencyKey", "currency"],
                    properties: {
                        orderId:        { type: "string", format: "uuid", example: "15ad97c5-ac6d-4303-8a5a-96a266450f6f" },
                        amount:         { type: "number", example: 50.75 },
                        paymentMethod:  { type: "string", enum: ["VISA", "MASTERCARD", "PAYPAL", "WALLET"], example: "VISA" },
                        idempotencyKey: { type: "string", example: "pay-123-ts-1700000000" },
                        currency:       { type: "string", example: "USD" },
                    },
                },
                PaymentResponse: {
                    type: "object",
                    properties: {
                        paymentId: { type: "string", format: "uuid" },
                        status:    { type: "string", enum: ["SUCCESS", "FAILED", "REFUNDED"] },
                        message:   { type: "string", example: "Payment processed successfully." },
                    },
                },

                // ── Errors ────────────────────────────────────────────────────
                ErrorResponse: {
                    type: "object",
                    properties: {
                        status:  { type: "string", example: "fail" },
                        message: { type: "string", example: "Detailed error message" },
                    },
                },
            },
        },
        // Applied globally to all protected routes — override per-route for public ones
        security: [{ bearerAuth: [] }],
    },
    // Scan these files for JSDoc @swagger annotations
    apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
