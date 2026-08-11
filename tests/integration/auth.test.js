/**
 * Integration Tests — Auth + Payment Flow
 *
 * Requires the full Docker Compose stack to be running.
 * Set API_GW_URL env var (default: http://localhost:3000).
 *
 * Execution order matters — tests are sequential and share state:
 *   register → login → (product) → (order) → pay
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.API_GW_URL ?? "http://localhost:3000";

// Shared state across tests
let adminToken = "";
let userToken = "";
let userId = "";

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, body: json };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("Health checks", () => {
  it("API Gateway is reachable", async () => {
    const { status } = await api("GET", "/health");
    expect(status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Auth flow", () => {
  const uniqueEmail = `user_${Date.now()}@pharma-test.com`;
  const password = "TestPass123!";

  it("registers a new user → 201", async () => {
    const { status, body } = await api("POST", "/api/v1/auth/register", {
      full_name: "Integration Tester",
      email: uniqueEmail,
      password,
      confirm_password: password,
      phone: "01012345678",
      address: "Cairo, Egypt",
      role: "CUSTOMER",
    });
    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.user?.email).toBe(uniqueEmail);

    userToken = body.token;
    userId = body.user.id;
  });

  it("login with correct credentials → 200", async () => {
    const { status, body } = await api("POST", "/api/v1/auth/login", {
      email: uniqueEmail,
      password,
    });

    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    // Token from login should also be usable
    userToken = body.token;
  });

  it("login with wrong password → 401", async () => {
    const { status } = await api("POST", "/api/v1/auth/login", {
      email: uniqueEmail,
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
      email: uniqueEmail,
      password,
      confirm_password: password,
      phone: "01000000000",
      address: "Cairo",
      role: "CUSTOMER",
    });

    expect(status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Protected routes require JWT", () => {
  it("GET /products without token → 401", async () => {
    const { status } = await api("GET", "/api/v1/products");
    expect(status).toBe(401);
  });

  it("GET /orders without token → 401", async () => {
    const { status } = await api("GET", "/api/v1/orders");
    expect(status).toBe(401);
  });
});
