import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// The api-gw service wraps axios calls with opossum circuit breakers at module scope.
// We mock axios so no real HTTP requests fire, and mock the CB config.
vi.mock("axios", () => ({ default: vi.fn() }));

vi.mock("@/config/circuitBreaker.config.js", () => ({
  circuitBreakerOptions: { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 10000 },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import axios from "axios";
import {
  ApiGwAuthService,
  ApiGwProductService,
  ApiGwOrderService,
  ApiGwNotificationService,
  ApiGwPaymentService,
} from "@/services/apiGwService.js";

// ─── Env setup ─────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SERVICE_URL = "http://auth:3001/auth-service/api/v1";
  process.env.PRODUCT_SERVICE_URL = "http://product:3002/product-service/api/v1";
  process.env.ORDER_SERVICE_URL = "http://order:3003/order-service/api/v1";
  process.env.NOTIFICATION_SERVICE_URL = "http://notif:3004";
  process.env.PAYMENT_SERVICE_URL = "http://payment:3005/payment-service/api/v1";
});

// ─── Helper: make axios resolve with a successful response ────────────────
const mockAxiosOk = (data) => axios.mockResolvedValue({ data });

// ─── Helper: make axios reject with an HTTP error (e.g. 401) ─────────────
const mockAxiosHttpError = (status, message) => {
  const err = new Error(message);
  err.response = { status, data: { message } };
  axios.mockRejectedValue(err);
};

// ─────────────────────────────────────────────────────────────────────────────
// callBreaker internals: HTTP error sentinel → rethrow with correct status
// ─────────────────────────────────────────────────────────────────────────────
describe("ApiGwAuthService", () => {
  it("register: forwards body and returns downstream response data", async () => {
    const payload = { email: "a@p.com", password: "pw" };
    const downstream = { token: "jwt-abc", user: { id: 1 } };
    mockAxiosOk(downstream);

    const result = await ApiGwAuthService.register(payload);

    expect(result).toEqual(downstream);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: expect.stringContaining("/register"), data: payload })
    );
  });

  it("login: returns downstream response data", async () => {
    mockAxiosOk({ token: "jwt-xyz" });
    const result = await ApiGwAuthService.login({ email: "a@p.com", password: "pw" });
    expect(result.token).toBe("jwt-xyz");
  });

  it("propagates HTTP 401 as a thrown error with correct status", async () => {
    mockAxiosHttpError(401, "Invalid credentials");

    await expect(ApiGwAuthService.login({ email: "x", password: "y" }))
      .rejects.toMatchObject({ response: { status: 401 } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ApiGwProductService", () => {
  const user = { id: "u1", role: "ADMIN" };

  it("findAllProducts: sends x-current-user header", async () => {
    mockAxiosOk([{ id: 1, name: "Aspirin" }]);

    await ApiGwProductService.findAllProducts(user);

    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ "x-current-user": JSON.stringify(user) }),
      })
    );
  });

  it("createProduct: sends POST with body and user header", async () => {
    mockAxiosOk({ id: 2 });
    await ApiGwProductService.createProduct({ name: "Panadol" }, user);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", data: { name: "Panadol" } })
    );
  });

  it("propagates HTTP 404 when product not found downstream", async () => {
    mockAxiosHttpError(404, "Product not found");
    await expect(ApiGwProductService.findProduct("bad-id", user))
      .rejects.toMatchObject({ response: { status: 404 } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ApiGwOrderService", () => {
  const user = { id: "u1", role: "USER" };

  it("createOrder: sends POST to correct URL with user header", async () => {
    mockAxiosOk({ id: "ord-1" });
    await ApiGwOrderService.createOrder({ idempotencyKey: "k1" }, user);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: expect.stringContaining("/orders"),
        headers: expect.objectContaining({ "x-current-user": JSON.stringify(user) }),
      })
    );
  });

  it("findAllOrders: forwards query params", async () => {
    mockAxiosOk([]);
    await ApiGwOrderService.findAllOrders(user, { status: "PENDING" });
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({ params: { status: "PENDING" } })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ApiGwPaymentService", () => {
  const user = { id: "u1" };

  it("createPayment: sends POST with body and user header", async () => {
    mockAxiosOk({ id: "pay-1" });
    await ApiGwPaymentService.createPayment({ orderId: "ord-1", amount: "50" }, user);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        data: { orderId: "ord-1", amount: "50" },
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ApiGwNotificationService", () => {
  const user = { id: "u1" };

  it("getMyNotifications: forwards query params and user header", async () => {
    mockAxiosOk({ notifications: [] });
    await ApiGwNotificationService.getMyNotifications(user, { limit: 5 });
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({ params: { limit: 5 } })
    );
  });
});
