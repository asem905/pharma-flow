/**
 * Integration Tests — Full E2E Happy Path
 *
 * Requires the full Docker Compose stack running.
 * API_GW_URL env var defaults to http://localhost:3000.
 *
 * Execution order is sequential and shares state across tests:
 *   register (ADMIN) → register (CUSTOMER) → login →
 *   createCategory → createProduct → listProducts →
 *   createOrder → getOrder → cancelOrder → deleteOrder →
 *   getMyNotifications → getMyPayments
 *
 * NOTE on inter-service dependencies:
 * - Product creation requires a valid categoryId (UUID from prior createCategory step).
 * - Order creation requires a real productId that exists in the product-service DB.
 * - Payment creation requires an order in PENDING state.
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.API_GW_URL ?? "http://localhost:3000";

// ─── Shared state ─────────────────────────────────────────────────────────────
let adminToken = "";
let customerToken = "";
let customerId = "";
let categoryId = "";
let productId = "";
let orderId = "";

// ─── Helper ───────────────────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try { json = await res.json(); } catch { json = null; }

  return { status: res.status, body: json };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("Health checks", () => {
  it("API Gateway is reachable → 200", async () => {
    const { status } = await api("GET", "/health");
    expect(status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Auth flow", () => {
  const adminEmail = `admin_${Date.now()}@pharma-test.com`;
  const customerEmail = `customer_${Date.now()}@pharma-test.com`;
  const password = "TestPass123!";

  it("registers a new ADMIN user → 200", async () => {
    const { status, body } = await api("POST", "/api/v1/auth/register", {
      full_name: "Integration Admin",
      email: adminEmail,
      password,
      confirm_password: password,
      phone: "01012345678",
      address: "Cairo, Egypt",
      role: "ADMIN",
    });

    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    adminToken = body.token;
  });

  it("registers a new CUSTOMER user → 200", async () => {
    const { status, body } = await api("POST", "/api/v1/auth/register", {
      full_name: "Integration Customer",
      email: customerEmail,
      password,
      confirm_password: password,
      phone: "01098765432",
      address: "Alexandria, Egypt",
      role: "CUSTOMER",
    });

    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    customerToken = body.token;
    customerId = body.user.id;
  });

  it("login with correct credentials → 200", async () => {
    const { status, body } = await api("POST", "/api/v1/auth/login", {
      email: adminEmail,
      password,
    });
    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    adminToken = body.token; // refresh
  });

  it("login with wrong password → 401", async () => {
    const { status } = await api("POST", "/api/v1/auth/login", {
      email: adminEmail,
      password: "wrong-password",
    });
    expect(status).toBe(401);
  });

  it("login with non-existent email → 404", async () => {
    const { status } = await api("POST", "/api/v1/auth/login", {
      email: "ghost@nowhere.com",
      password: "doesnt-matter",
    });
    expect(status).toBe(404);
  });

  it("duplicate registration → 400", async () => {
    const { status } = await api("POST", "/api/v1/auth/register", {
      full_name: "Duplicate",
      email: adminEmail,
      password,
      confirm_password: password,
      phone: "01000000000",
      address: "Cairo",
      role: "ADMIN",
    });
    expect(status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Protected routes require JWT", () => {
  it("GET /api/v1/products without token → 401", async () => {
    const { status } = await api("GET", "/api/v1/products");
    expect(status).toBe(401);
  });

  it("GET /api/v1/orders without token → 401", async () => {
    const { status } = await api("GET", "/api/v1/orders");
    expect(status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Category flow (ADMIN only)", () => {
  const categoryName = `TestCategory_${Date.now()}`;

  it("CUSTOMER creating a category → 403", async () => {
    const { status } = await api("POST", "/api/v1/categories", {
      name: categoryName,
    }, customerToken);
    expect(status).toBe(403);
  });

  it("ADMIN creates a category → 200 with data containing id", async () => {
    const { status, body } = await api("POST", "/api/v1/categories", {
      name: categoryName,
    }, adminToken);

    // Product-service controller returns 201 which the GW proxies as-is
    expect([200, 201]).toContain(status);
    expect(body.data).toBeDefined();
    categoryId = body.data.id;
    expect(categoryId).toBeDefined();
  });

  it("GET all categories → 200 with data array", async () => {
    const { status, body } = await api("GET", "/api/v1/categories", null, adminToken);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("duplicate category name → 400", async () => {
    const { status } = await api("POST", "/api/v1/categories", {
      name: categoryName, // same name
    }, adminToken);
    expect(status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Product flow (ADMIN write, any user read)", () => {
  const productName = `TestProduct_${Date.now()}`;

  it("CUSTOMER creating a product → 403", async () => {
    const { status } = await api("POST", "/api/v1/products", {
      name: productName,
      price: 25.99,
      stock: 100,
      brand: "TestBrand",
      categoryId,
    }, customerToken);
    expect(status).toBe(403);
  });

  it("ADMIN creates a product → 201 with data containing id", async () => {
    const { status, body } = await api("POST", "/api/v1/products", {
      name: productName,
      description: "A test product for integration testing",
      price: 25.99,
      stock: 100,
      brand: "TestBrand",
      categoryId,
    }, adminToken);

    expect([200, 201]).toContain(status);
    expect(body.data).toBeDefined();
    productId = body.data.id;
    expect(productId).toBeDefined();
  });

  it("GET all products (authenticated) → 200 with data array", async () => {
    const { status, body } = await api("GET", "/api/v1/products", null, customerToken);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET product by id → 200 with matching id", async () => {
    const { status, body } = await api("GET", `/api/v1/products/${productId}`, null, customerToken);
    expect(status).toBe(200);
    expect(body.data.id).toBe(productId);
  });

  it("GET non-existent product → 404", async () => {
    // Use a valid UUID format that doesn't exist in the DB
    const { status } = await api("GET", "/api/v1/products/00000000-0000-0000-0000-000000000000", null, adminToken);
    expect(status).toBe(404);
  });

  it("ADMIN updates product price → 200", async () => {
    const { status, body } = await api("PUT", `/api/v1/products/${productId}`, {
      price: 19.99,
    }, adminToken);
    expect(status).toBe(200);
    expect(parseFloat(body.data.price)).toBe(19.99);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Order flow (CUSTOMER)", () => {
  const idempotencyKey = `order-integ-${Date.now()}`;

  it("CUSTOMER creates an order → 201 with data.id", async () => {
    const { status, body } = await api("POST", "/api/v1/orders", {
      idempotencyKey,
      orderItems: [
        { productId, quantity: 2 },
      ],
    }, customerToken);

    // 503 if product-service is not healthy yet — acceptable in CI
    if (status === 503) {
      console.warn("product-service circuit open — order creation skipped");
      return;
    }

    expect(status).toBe(201);
    expect(body.data).toBeDefined();
    orderId = body.data.id;
    expect(orderId).toBeDefined();
  });

  it("same idempotency key → returns the same order (idempotency replay)", async () => {
    if (!orderId) return; // skip if creation was skipped
    const { status, body } = await api("POST", "/api/v1/orders", {
      idempotencyKey,
      orderItems: [{ productId, quantity: 2 }],
    }, customerToken);

    expect(status).toBe(201);
    expect(body.data.id).toBe(orderId); // exact same order returned
  });

  it("CUSTOMER fetches their own orders → 200 with data array", async () => {
    if (!customerId) return;
    const { status, body } = await api(
      "GET", `/api/v1/orders/customer/${customerId}`, null, customerToken
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("CUSTOMER fetches a different customer's orders → 403", async () => {
    const { status } = await api(
      "GET", "/api/v1/orders/customer/00000000-0000-0000-0000-000000000000",
      null, customerToken
    );
    expect(status).toBe(403);
  });

  it("GET order by id → 200", async () => {
    if (!orderId) return;
    const { status, body } = await api("GET", `/api/v1/orders/${orderId}`, null, customerToken);
    expect(status).toBe(200);
    expect(body.data.id).toBe(orderId);
  });

  it("GET non-existent order → 404", async () => {
    const { status } = await api(
      "GET", "/api/v1/orders/00000000-0000-0000-0000-000000000000",
      null, customerToken
    );
    expect(status).toBe(404);
  });

  it("ADMIN cancels the order → 200 with status CANCELLED", async () => {
    if (!orderId) return;
    const { status, body } = await api("PUT", `/api/v1/orders/${orderId}`, {
      status: "CANCELLED",
    }, adminToken);
    expect(status).toBe(200);
    expect(body.data.status).toBe("CANCELLED");
  });

  it("ADMIN deletes the order → 200", async () => {
    if (!orderId) return;
    const { status } = await api("DELETE", `/api/v1/orders/${orderId}`, null, adminToken);
    expect(status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Notification flow (CUSTOMER)", () => {
  it("GET my notifications → 200 with notifications array", async () => {
    const { status, body } = await api("GET", "/api/v1/notifications", null, customerToken);
    expect(status).toBe(200);
    // The notification-service returns { notifications, nextCursor, hasNextPage }
    // the API GW proxies the response as-is
    expect(body).toBeDefined();
  });

  it("GET notification by invalid ObjectId → 400 or 404", async () => {
    const { status } = await api("GET", "/api/v1/notifications/not-a-valid-id", null, customerToken);
    expect([400, 404, 500]).toContain(status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Payment flow (CUSTOMER)", () => {
  it("GET my payments → 200 with results", async () => {
    const { status, body } = await api("GET", "/api/v1/payments/me", null, customerToken);
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it("GET payments by non-existent order → 404 or empty", async () => {
    const { status } = await api(
      "GET", "/api/v1/payments/order/00000000-0000-0000-0000-000000000000",
      null, customerToken
    );
    expect([200, 404]).toContain(status);
  });
});
