import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must precede all imports) ────────────────────────────────────────
vi.mock("@/model/ordersModel.js", () => ({
  default: {
    findByIdempotencyKey: vi.fn(),
    findOrder: vi.fn(),
    createOrder: vi.fn(),
    deleteOrder: vi.fn(),
    updateOrder: vi.fn(),
    findAllOrders: vi.fn(),
    findOrdersForCustomer: vi.fn(),
  },
}));

vi.mock("@/grpc/productGrpcClient.js", () => ({
  getProductsInfo: vi.fn(),
  validateAndReserveStock: vi.fn(),
  decrementStock: vi.fn(),
}));

vi.mock("@/events/orderPublisher.js", () => ({
  publishOrderPlaced: vi.fn(),
  publishOrderCancelled: vi.fn(),
  publishOrderDeleted: vi.fn(),
  publishStockAdjust: vi.fn(),
  publishOrderUpdated: vi.fn(),
}));

vi.mock("@/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/config/circuitBreaker.config.js", () => ({
  circuitBreakerOptions: { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 10000 },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { OrdersService } from "@/service/ordersService.js";
import ordersModel from "@/model/ordersModel.js";
import { validateAndReserveStock } from "@/grpc/productGrpcClient.js";
import { publishOrderPlaced, publishOrderCancelled, publishOrderDeleted } from "@/events/orderPublisher.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeOrderData = (overrides = {}) => ({
  idempotencyKey: "order-idem-1",
  orderItems: [
    { productId: "prod-1", quantity: 2 },
    { productId: "prod-2", quantity: 1 },
  ],
  ...overrides,
});

const makeCreatedOrder = () => ({
  id: "ord-1",
  userId: "user-1",
  totalPrice: "25.00",
  status: "PENDING",
  orderItems: [
    { productId: "prod-1", quantity: 2, price: "10.00" },
    { productId: "prod-2", quantity: 1, price: "5.00" },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
describe("OrdersService.createOrder()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing order on idempotency key replay", async () => {
    const existing = makeCreatedOrder();
    ordersModel.findByIdempotencyKey.mockResolvedValue(existing);

    const result = await OrdersService.createOrder(makeOrderData(), "user-1", "u@p.com");

    expect(result).toEqual(existing);
    expect(validateAndReserveStock).not.toHaveBeenCalled();
  });

  it("returns 503 when product-service circuit is open (fallback fires)", async () => {
    ordersModel.findByIdempotencyKey.mockResolvedValue(null);
    // Simulate circuit-open fallback sentinel
    validateAndReserveStock.mockResolvedValue({ __circuitOpen: true });

    const result = await OrdersService.createOrder(makeOrderData(), "user-1", "u@p.com");

    expect(result.statusCode).toBe(503);
    expect(result.message).toMatch(/unavailable/i);
  });

  it("returns 409 when stock reservation is rejected", async () => {
    ordersModel.findByIdempotencyKey.mockResolvedValue(null);
    validateAndReserveStock.mockResolvedValue({
      success: false,
      failed_product_id: "prod-1",
      message: "Out of stock",
    });

    const result = await OrdersService.createOrder(makeOrderData(), "user-1", "u@p.com");

    expect(result.statusCode).toBe(409);
    expect(result.message).toMatch(/stock error/i);
  });

  it("creates order and publishes event on success", async () => {
    ordersModel.findByIdempotencyKey.mockResolvedValue(null);
    validateAndReserveStock.mockResolvedValue({
      success: true,
      reserved: [
        { product_id: "prod-1", price: "10.00" },
        { product_id: "prod-2", price: "5.00" },
      ],
    });
    const order = makeCreatedOrder();
    ordersModel.createOrder.mockResolvedValue(order);

    const result = await OrdersService.createOrder(makeOrderData(), "user-1", "u@p.com");

    expect(result).toEqual(order);
    expect(ordersModel.createOrder).toHaveBeenCalledWith(
      "user-1",
      "order-idem-1",
      "25.00",
      expect.arrayContaining([
        expect.objectContaining({ productId: "prod-1", quantity: 2, price: "10.00" }),
      ])
    );
    expect(publishOrderPlaced).toHaveBeenCalledWith(order, "u@p.com");
  });

  it("returns 500 and rolls back stock on DB failure", async () => {
    ordersModel.findByIdempotencyKey.mockResolvedValue(null);
    validateAndReserveStock.mockResolvedValue({
      success: true,
      reserved: [{ product_id: "prod-1", price: "10.00" }, { product_id: "prod-2", price: "5.00" }],
    });
    ordersModel.createOrder.mockRejectedValue(new Error("DB write timeout"));

    const result = await OrdersService.createOrder(makeOrderData(), "user-1", "u@p.com");

    expect(result.statusCode).toBe(500);
    // Stock rollback event must be published
    expect(publishOrderDeleted).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("OrdersService.deleteOrder()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when order not found", async () => {
    ordersModel.findOrder.mockResolvedValue(null);

    const result = await OrdersService.deleteOrder("ord-999");

    expect(result.statusCode).toBe(404);
    expect(ordersModel.deleteOrder).not.toHaveBeenCalled();
  });

  it("deletes PENDING order and publishes restore-stock event", async () => {
    const order = makeCreatedOrder(); // status = PENDING
    ordersModel.findOrder.mockResolvedValue(order);
    ordersModel.deleteOrder.mockResolvedValue(order);

    const result = await OrdersService.deleteOrder("ord-1");

    expect(result).toEqual(order);
    expect(publishOrderDeleted).toHaveBeenCalledWith(order);
  });

  it("deletes DELIVERED order WITHOUT publishing restore-stock event", async () => {
    const order = { ...makeCreatedOrder(), status: "DELIVERED" };
    ordersModel.findOrder.mockResolvedValue(order);
    ordersModel.deleteOrder.mockResolvedValue(order);

    await OrdersService.deleteOrder("ord-1");

    // Stock should not be restored for delivered orders
    expect(publishOrderDeleted).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("OrdersService.findOrder()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns order when found", async () => {
    const order = makeCreatedOrder();
    ordersModel.findOrder.mockResolvedValue(order);

    const result = await OrdersService.findOrder("ord-1");

    expect(result).toEqual(order);
  });

  it("returns 404 when order not found", async () => {
    ordersModel.findOrder.mockResolvedValue(null);

    const result = await OrdersService.findOrder("ord-999");

    expect(result.statusCode).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("OrdersService.updateOrder() — status cancellation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes cancel event when status changes to CANCELLED", async () => {
    const order = makeCreatedOrder(); // status = PENDING, no orderItems to restock via update path
    ordersModel.findOrder.mockResolvedValue(order);
    const updated = { ...order, status: "CANCELLED" };
    ordersModel.updateOrder.mockResolvedValue(updated);

    await OrdersService.updateOrder("ord-1", { status: "CANCELLED" }, "u@p.com");

    expect(publishOrderCancelled).toHaveBeenCalledWith(order, "u@p.com");
  });

  it("returns 404 when order not found", async () => {
    ordersModel.findOrder.mockResolvedValue(null);

    const result = await OrdersService.updateOrder("ord-999", { status: "CANCELLED" }, "u@p.com");

    expect(result.statusCode).toBe(404);
  });
});
