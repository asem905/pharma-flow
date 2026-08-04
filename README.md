# PharmaFlow — Backend Monorepo

A production-ready **microservices backend** for a pharmaceutical e-commerce platform. Built with Node.js / Express, using a combination of synchronous gRPC calls and asynchronous RabbitMQ event-driven communication.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
  - [API Gateway](#1-api-gateway-api-gw)
  - [Auth Service](#2-auth-service)
  - [Product Service](#3-product-service)
  - [Order Service](#4-order-service)
  - [Payment Service](#5-payment-service)
  - [Notification Service](#6-notification-service)
- [Communication Patterns](#communication-patterns)
  - [RabbitMQ — Async Event Bus](#rabbitmq--async-event-bus)
  - [gRPC — Synchronous Internal Calls](#grpc--synchronous-internal-calls)
- [Shared Proto Definitions](#shared-proto-definitions)
- [Project Structure](#project-structure)

---

## Architecture Overview

```
                        ┌────────────────────────────────────────────────────┐
                        │                  API Gateway                       │
                        │  :PORT  |  Rate Limiting  |  JWT Verify  |  Swagger│
                        └──────────────┬─────────────────────────────────────┘
                                       │  HTTP proxy (http-proxy-middleware)
         ┌─────────────────────────────┼──────────────────────────────────────┐────────────────────────
         │                             │                                      │
         ▼                             ▼                                      ▼
  ┌─────────────┐             ┌────────────────┐                    ┌──────────────────┐
  │ Auth Service│             │ Product Service│                    │  Order Service   │
  │  (Prisma)   │             │ (Prisma+Redis) │                    │    (Prisma)      │
  └─────────────┘             │  gRPC Server   │◄──── gRPC ──────── │  gRPC Server     │
                              └────────────────┘                    └──────────────────┘
                                       ▲                                      │
                                       │              ┌───────────────────────┘
                                       │              │
                              ┌────────────────┐      │         ┌──────────────────┐
                              │   RabbitMQ     │◄─────┘         │  Payment Service │
                              │ pharmaflow.    │                │                  │
                              │   events       │◄─ payment.*────│  gRPC Client     │
                              │ (topic exch.)  │                └──────────────────┘
                              └────────────────┘
                                 │         │
                    order.*      │         │  payment.*
                    ┌────────────┘         └──────────────┐
                    ▼                                      ▼
           ┌────────────────┐                   ┌────────────────────┐
           │ Product Service│                   │Notification Svc    │
           │ stockConsumer  │                   │  (MongoDB)         │
           │ (stock.restore │                   │notificationConsumer│
           │  stock.adjust) │                   │  (all events)      │
           └────────────────┘                   └────────────────────┘
```

---

## Services

### 1. API Gateway (`api-gw`)

The single entry point for all client traffic. No business logic lives here — it proxies requests to downstream services after authentication.

**Port:** `process.env.PORT`  
**Base path:** `/api/v1`

#### Responsibilities
- **JWT verification** — `verifyToken` middleware validates the Bearer token on all protected routes and injects a `x-current-user` header with the decoded payload before forwarding.
- **Rate limiting** — 100 requests per 5-minute window per IP (`express-rate-limit`).
- **Security headers** — `helmet` applied globally.
- **Swagger UI** — Full OpenAPI 3.0 docs served at `/api/v1/docs` (raw JSON at `/api/v1/docs.json`).

#### Routes (proxied)

| Method | Gateway Path | Forwards To |
|--------|-------------|-------------|
| `POST` | `/api/v1/auth/register` | `auth-service` |
| `POST` | `/api/v1/auth/login` | `auth-service` |
| `*` | `/api/v1/products` | `product-service` |
| `*` | `/api/v1/categories` | `product-service` |
| `*` | `/api/v1/orders/*` | `order-service` |
| `*` | `/api/v1/notifications/*` | `notification-service` |
| `GET` | `/api/v1/health` | inline health check |

---

### 2. Auth Service

Handles user identity — registration, login, and account management.

**Port:** `process.env.PORT`  
**Internal base path:** `/auth-service/api/v1`  
**Database:** PostgreSQL via **Prisma**

#### Key Features
- **Bloom filter** — seeded with all existing emails at startup to provide O(1) duplicate-email detection before hitting the database.
- **Zod validation** — `validateRegister` / `validateLogin` middleware reject malformed payloads early.
- **JWT issuance** — returns a signed token on successful login/register.

#### Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/register` | Public | Create a new user account |
| `POST` | `/login` | Public | Authenticate and receive JWT |
| `PUT` | `/update` | Auth | Update account details |
| `DELETE` | `/delete` | Auth | Delete account |
| `GET` | `/users` | Admin | List all users |

---

### 3. Product Service

Manages the pharmaceutical product catalogue and categories.

**Port:** `process.env.PORT`  
**Internal base path:** `/product-service/api/v1`  
**Database:** PostgreSQL via **Prisma**  
**Cache:** Redis (cache-aside pattern)

#### Key Features
- **Redis caching** — `cacheService` wraps product reads with a fire-and-forget invalidation strategy. Cache keys:
  - `products:<id>` — individual product
  - `products:all` — product listing
  - `products:category:<id>` — products by category
- **gRPC server** — exposes `ProductService` for internal stock reservation calls from the Order service.
- **RabbitMQ consumer** — `startStockConsumer()` listens on two queues:

| Queue | Routing Key(s) | Action |
|-------|---------------|--------|
| `stock.restore` | `order.cancelled`, `order.deleted` | Restores stock in bulk via single raw SQL `UPDATE` |
| `stock.adjust` | `order.item.updated` | Adjusts stock deltas when order quantities decrease |

- **Role-based access** — `validateRole` middleware enforces ADMIN-only write operations.

#### Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/categories` | ADMIN | Create category |
| `PUT` | `/categories/:id` | ADMIN | Update category |
| `DELETE` | `/categories/:id` | ADMIN | Delete category |
| `GET` | `/categories` | ADMIN, CUSTOMER | List categories |
| `GET` | `/categories/:id` | ADMIN, CUSTOMER | Get category |
| `POST` | `/products` | ADMIN | Create product |
| `PUT` | `/products/:id` | ADMIN | Update product |
| `DELETE` | `/products/:id` | ADMIN | Delete product |
| `GET` | `/products` | ADMIN, CUSTOMER | List products |
| `GET` | `/products/:id` | ADMIN, CUSTOMER | Get product |

---

### 4. Order Service

Manages the full order lifecycle from placement through confirmation/cancellation.

**Port:** `process.env.PORT`  
**Internal base path:** `/order-service/api/v1`  
**Database:** PostgreSQL via **Prisma**

#### Key Features
- **gRPC client** — calls `ProductService.CheckAndReserveStock` synchronously on order creation to atomically validate and reserve stock.
- **gRPC server** — exposes `OrderService.GetOrderById` for the Payment service to verify order ownership before processing payments.
- **RabbitMQ publisher** — publishes lifecycle events to the `pharmaflow.events` topic exchange:

| Event (routing key) | Trigger | Consumers |
|--------------------|---------|-----------|
| `order.placed` | Order created | `notification-service` |
| `order.cancelled` | Order cancelled | `product-service` (stock restore), `notification-service` |
| `order.deleted` | Order hard-deleted | `product-service` (stock restore) |
| `order.item.updated` | Item quantity decreased | `product-service` (stock adjust) |
| `order.updated` | Any status change | `notification-service` |

- **RabbitMQ consumer** — `startOrderConsumer()` listens on the `orders.payments` queue:

| Routing Key | Action |
|-------------|--------|
| `payment.success` | Updates order status → `CONFIRMED` |
| `payment.failed` | Logs warning; order remains `PENDING` (user can retry) |

- **Cursor-based pagination** — order listings use efficient cursor pagination.
- **Zod validation** — `validateCreateOrder` / `validateOrderQuery` reject malformed requests.

#### Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/orders` | ADMIN, CUSTOMER | Place a new order (reserves stock via gRPC) |
| `PUT` | `/orders/:id` | ADMIN, CUSTOMER | Update order / items |
| `DELETE` | `/orders/:id` | ADMIN, CUSTOMER | Cancel / delete order |
| `GET` | `/orders/customer/:id` | ADMIN, CUSTOMER | List orders for a specific customer |
| `GET` | `/orders/:id` | ADMIN, CUSTOMER | Get a single order |
| `GET` | `/orders` | ADMIN | List all orders |

---

### 5. Payment Service

Processes payments against existing orders.

**Port:** `process.env.PORT`  
**Internal base path:** `/payment-service/api/v1`  
**Database:** MongoDB via **Mongoose**

#### Key Features
- **gRPC client** — calls `OrderService.GetOrderById` before creating a payment to:
  1. Verify the order exists.
  2. Confirm the requesting user owns the order (`order.user_id === paymentData.userId`, using `keepCase: true` proto field names).
  3. Confirm the order is in `PENDING` status.
- **RabbitMQ publisher** — publishes payment outcome events:

| Event (routing key) | Trigger | Consumers |
|--------------------|---------|-----------|
| `payment.success` | Payment record created | `order-service` (→ CONFIRMED), `notification-service` |
| `payment.failed` | DB write error | `notification-service` |
| `payment.refunded` | Refund processed | `notification-service` |

- **Design decision** — on payment failure, the order is **not cancelled**. The `payment.failed` event is published, the error is returned to the client, and the order stays `PENDING` so the user can retry with a different payment method.
- **Zod validation** — `validatePaymentBody`, `validateOrderId`, `validatePaymentId`.

#### Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/` | Authenticated | Create a payment for an order |
| `GET` | `/me` | Authenticated | List my payments |
| `GET` | `/order/:orderId` | Authenticated / ADMIN | Get payments for a specific order |
| `GET` | `/:id` | Authenticated / ADMIN | Get a single payment |

---

### 6. Notification Service

Persists in-app notifications triggered by order and payment lifecycle events.

**Port:** `process.env.PORT`  
**Internal base path:** `/notifications-service/api/v1`  
**Database:** MongoDB via **Mongoose**

#### Key Features
- **RabbitMQ consumer** — `startNotificationConsumer()` uses a single durable queue (`notifications.orders`) bound to all relevant routing keys. Processed in a clean `TYPE_MAP` + `MESSAGE_BUILDERS` lookup pattern — adding a new event type requires only two lines.

| Routing Key | Notification Type | Message |
|-------------|------------------|---------|
| `order.placed` | `ORDER_PLACED` | "Your order #X has been placed. Total: $Y." |
| `order.cancelled` | `ORDER_CANCELLED` | "Your order #X has been cancelled." |
| `order.updated` | `ORDER_UPDATED` | "Your order #X status is now Y. Total: $Z." |
| `payment.success` | `PAYMENT_SUCCESS` | "Your payment of $X for order #Y was processed successfully." |
| `payment.failed` | `PAYMENT_FAILED` | "Your payment of $X for order #Y failed. Please retry..." |

- **Cursor-based pagination** — O(log n) cursor pagination for notification lists, replacing skip-based O(n) approaches.
- **Zod validation** — `validateNotificationQuery` / `validateNotificationParams`.

#### Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/notifications?cursor=&limit=` | Authenticated | Paginated notifications for logged-in user |
| `GET` | `/notifications/:id` | Authenticated | Get a single notification |
| `DELETE` | `/notifications/:id` | Authenticated | Delete a notification |

---

## Communication Patterns

### RabbitMQ — Async Event Bus

All services connect to a **single shared topic exchange**: `pharmaflow.events` (durable).

**Key design decisions:**
- `persistent: true` on every published message — survives broker restart.
- All queues declared `durable: true` — survive broker restart.
- `prefetch(1)` on all consumers — prevents DB overload under high traffic.
- `nack(msg, false, false)` on errors — no infinite requeue loops. Use a dead-letter queue (DLQ) in production.
- Publishers are fire-and-forget — they do not block the HTTP response.
- Each message payload includes a `timestamp` field stamped by the `publish()` helper.

```
Exchange: pharmaflow.events  (type: topic, durable: true)

  order-service  ──publishes──►  order.placed
                                 order.cancelled
                                 order.deleted
                                 order.item.updated
                                 order.updated

  payment-service ─publishes──►  payment.success
                                  payment.failed
                                  payment.refunded

  product-service ─consumes──►  stock.restore  queue  ◄── order.cancelled, order.deleted
                                 stock.adjust   queue  ◄── order.item.updated

  order-service   ─consumes──►  orders.payments queue  ◄── payment.success, payment.failed

  notification-service consumes► notifications.orders queue ◄── order.placed, order.cancelled,
                                                                  order.updated, payment.success,
                                                                  payment.failed
```

### gRPC — Synchronous Internal Calls

Used when a service needs an **immediate, strongly-typed response** before it can proceed.

| Client | Server | RPC | Purpose |
|--------|--------|-----|---------|
| `order-service` | `product-service` | `CheckAndReserveStock` | Validate & atomically reserve stock during order creation |
| `payment-service` | `order-service` | `GetOrderById` | Verify order existence and ownership before accepting payment |

**Shared proto files** live in `/proto/` at the monorepo root and are resolved by path in both client and server, ensuring a single source of truth.

All gRPC connections use `keepCase: true` in `protoLoader` — proto field names are preserved as-is (`user_id`, `order_id`, etc.) in both client and server.

---

## Shared Proto Definitions

Located at `/proto/` (monorepo root):

```
proto/
├── order.proto    — OrderService.GetOrderById
└── product.proto  — ProductService.CheckAndReserveStock, GetProductById, etc.
```

---

## Project Structure

```
pharma-flow-backend/
├── proto/                        # Shared gRPC proto definitions
│   ├── order.proto
│   └── product.proto
│
├── api-gw/                       # API Gateway
│   └── src/
│       ├── config/swagger.js     # OpenAPI spec
│       ├── controllers/          # Proxy controllers
│       ├── middlewares/verifyToken.js
│       └── routes/               # Swagger-annotated route files
│
├── auth-service/                 # Authentication & user management
│   └── src/
│       ├── config/db.js          # Prisma client
│       ├── model/                # Prisma user model wrapper
│       ├── service/
│       │   ├── authService.js
│       │   └── bloomFilterService.js
│       ├── middlewares/authValidn.js
│       └── controller/authController.js
│
├── product-service/              # Product catalogue + stock management
│   └── src/
│       ├── config/               # Prisma, RabbitMQ, Redis
│       ├── grpc/productGrpcServer.js
│       ├── events/stockConsumer.js
│       ├── service/
│       │   ├── productsService.js
│       │   ├── categoryService.js
│       │   └── cacheService.js
│       └── controller/
│
├── order-service/                # Order lifecycle management
│   └── src/
│       ├── config/               # Prisma, RabbitMQ
│       ├── grpc/
│       │   ├── orderGrpcServer.js    # exposes GetOrderById
│       │   └── productGrpcClient.js  # calls CheckAndReserveStock
│       ├── events/
│       │   ├── orderPublisher.js
│       │   └── orderConsumer.js      # listens for payment.success / payment.failed
│       └── controller/
│
├── payment-service/              # Payment processing
│   └── src/
│       ├── config/rabbitmq.js
│       ├── grpc/orderGrpcClient.js   # calls GetOrderById
│       ├── events/paymentPublisher.js
│       ├── service/paymentService.js
│       └── controller/paymentController.js
│
└── notification-service/         # In-app notification persistence
    └── src/
        ├── config/               # MongoDB, RabbitMQ
        ├── events/notificationConsumer.js
        ├── models/Notification.js
        ├── service/notificationService.js
        └── controller/notificationController.js
```
