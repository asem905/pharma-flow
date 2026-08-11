import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all module-level side-effecting imports BEFORE service import ────
// Uses @/ alias (resolves to payment-service/src/) so mock specifiers match
// exactly what the service itself imports.

vi.mock("@/model/paymentModel.js", () => ({
  default: {
    createPayment: vi.fn(),
    getMyPayments: vi.fn(),
    getPaymentByOrderId: vi.fn(),
    getPaymentById: vi.fn(),
    getPaymentByIdempotencyKey: vi.fn(),
    getFailedPaymentWithPendingRefund: vi.fn(),
    markRefundResolved: vi.fn(),
    createFailedPayment: vi.fn(),
  },
}));

vi.mock("@/grpc/orderGrpcClient.js", () => ({
  getOrderById: vi.fn(),
}));

vi.mock("@/grpc/authGrpcClient.js", () => ({
  deductBudget: vi.fn(),
  reverseBudget: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/events/paymentPublisher.js", () => ({
  publishPaymentSuccess: vi.fn(),
  publishPaymentFailed: vi.fn(),
  publishPaymentOverpaid: vi.fn(),
  publishPaymentRefunded: vi.fn(),
}));

vi.mock("@/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/config/circuitBreaker.config.js", () => ({
  circuitBreakerOptions: {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
  },
}));

// ─── Import after all mocks ───────────────────────────────────────────────
import { PaymentService } from "@/service/paymentService.js";
import paymentModel from "@/model/paymentModel.js";
import { getOrderById } from "@/grpc/orderGrpcClient.js";
import { deductBudget } from "@/grpc/authGrpcClient.js";
import {
  publishPaymentSuccess,
  publishPaymentFailed,
  publishPaymentOverpaid,
} from "@/events/paymentPublisher.js";

// ─── Helpers ──────────────────────────────────────────────────────────────
const makePaymentData = (overrides = {}) => ({
  orderId: "order-1",
  userId: "user-1",
  email: "user@pharma.com",
  amount: "100.00",
  method: "CASH",
  idempotencyKey: "idem-key-1",
  ...overrides,
});

const makePendingOrder = (overrides = {}) => ({
  order_id: "order-1",
  user_id: "user-1",
  total_price: "100.00",
  status: "PENDING",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// PURE FUNCTION — zero mocks needed
// ─────────────────────────────────────────────────────────────────────────────
describe("PaymentService._calculateAmounts()", () => {
  const svc = new PaymentService();

  it("exact payment: no underpayment, no overpayment", () => {
    const result = svc._calculateAmounts("100.00", "100.00");
    expect(result.isUnderpayment).toBe(false);
    expect(result.shortfall).toBe(0);
    expect(result.overpaymentChange).toBe(0);
    expect(result.orderTotal).toBe(100);
    expect(result.paidAmount).toBe(100);
  });

  it("underpayment: shortfall = orderTotal - paid", () => {
    const result = svc._calculateAmounts("100.00", "60.00");
    expect(result.isUnderpayment).toBe(true);
    expect(result.shortfall).toBe(40);
    expect(result.overpaymentChange).toBe(0);
  });

  it("overpayment: overpaymentChange = paid - orderTotal", () => {
    const result = svc._calculateAmounts("100.00", "130.00");
    expect(result.isUnderpayment).toBe(false);
    expect(result.overpaymentChange).toBe(30);
    expect(result.shortfall).toBe(0);
  });

  it("handles floating point correctly via toFixed(2)", () => {
    // naive JS: 100.00 - 99.99 = 0.010000000000005700
    const result = svc._calculateAmounts("100.00", "99.99");
    expect(result.shortfall).toBe(0.01);
  });

  it("large overpayment is handled correctly", () => {
    const result = svc._calculateAmounts("50.00", "1000.00");
    expect(result.isUnderpayment).toBe(false);
    expect(result.overpaymentChange).toBe(950);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createPayment — validation / guard paths
// ─────────────────────────────────────────────────────────────────────────────
describe("PaymentService.createPayment() — guard paths", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new PaymentService();
    paymentModel.getPaymentByIdempotencyKey.mockResolvedValue(null);
    paymentModel.getFailedPaymentWithPendingRefund.mockResolvedValue(null);
  });

  it("returns 404 when order is not found (getOrderById returns null)", async () => {
    getOrderById.mockResolvedValue(null);

    const result = await svc.createPayment(makePaymentData());

    expect(result.statusCode).toBe(404);
    expect(result.message).toMatch(/not found/i);
  });

  it("returns 403 when userId does not match order owner", async () => {
    getOrderById.mockResolvedValue(makePendingOrder({ user_id: "different-user" }));

    const result = await svc.createPayment(makePaymentData({ userId: "user-1" }));

    expect(result.statusCode).toBe(403);
    expect(result.message).toMatch(/not authorized/i);
  });

  it("returns 400 when order is not in PENDING status", async () => {
    getOrderById.mockResolvedValue(makePendingOrder({ status: "COMPLETED" }));

    const result = await svc.createPayment(makePaymentData());

    expect(result.statusCode).toBe(400);
    expect(result.message).toMatch(/pending/i);
  });

  it("returns existing payment when idempotency key hits a SUCCESS record", async () => {
    const existingPayment = { id: "pay-99", status: "SUCCESS", orderId: "order-1" };
    paymentModel.getPaymentByIdempotencyKey.mockResolvedValue(existingPayment);
    getOrderById.mockResolvedValue(makePendingOrder());

    const result = await svc.createPayment(makePaymentData());

    // Must replay the cached result — no new DB write
    expect(result).toEqual(existingPayment);
    expect(paymentModel.createPayment).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createPayment — success paths
// ─────────────────────────────────────────────────────────────────────────────
describe("PaymentService.createPayment() — success paths", () => {
  let svc;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new PaymentService();
    paymentModel.getPaymentByIdempotencyKey.mockResolvedValue(null);
    paymentModel.getFailedPaymentWithPendingRefund.mockResolvedValue(null);
  });

  it("exact payment: creates record, publishes success, budgetCreditsUsed = 0", async () => {
    getOrderById.mockResolvedValue(makePendingOrder({ total_price: "100.00" }));
    const created = { id: "pay-1", orderId: "order-1", userId: "user-1", amount: 100, method: "CASH" };
    paymentModel.createPayment.mockResolvedValue(created);

    const result = await svc.createPayment(makePaymentData({ amount: "100.00" }));

    expect(paymentModel.createPayment).toHaveBeenCalledOnce();
    expect(publishPaymentSuccess).toHaveBeenCalledOnce();
    expect(result.id).toBe("pay-1");
    expect(result.budgetCreditsUsed).toBe(0);
  });

  it("overpayment: publishes both success + overpaid events, returns remainingAmount", async () => {
    getOrderById.mockResolvedValue(makePendingOrder({ total_price: "100.00" }));
    const created = { id: "pay-2", orderId: "order-1", userId: "user-1", amount: 150, method: "CASH" };
    paymentModel.createPayment.mockResolvedValue(created);

    const result = await svc.createPayment(makePaymentData({ amount: "150.00" }));

    expect(publishPaymentSuccess).toHaveBeenCalledOnce();
    expect(publishPaymentOverpaid).toHaveBeenCalledOnce();
    expect(result.remainingAmount).toBe(50);
  });

  it("underpayment: deducts budget, creates payment, returns correct budgetCreditsUsed", async () => {
    getOrderById.mockResolvedValue(makePendingOrder({ total_price: "100.00" }));
    deductBudget.mockResolvedValue({ success: true, remaining_budget: 40 });
    const created = { id: "pay-3", orderId: "order-1", userId: "user-1", amount: 60, method: "CASH" };
    paymentModel.createPayment.mockResolvedValue(created);

    const result = await svc.createPayment(makePaymentData({ amount: "60.00" }));

    expect(deductBudget).toHaveBeenCalledWith({ user_id: "user-1", amount: 40 });
    expect(result.budgetCreditsUsed).toBe(40);
  });

  it("underpayment with insufficient budget: returns 400, no DB write", async () => {
    getOrderById.mockResolvedValue(makePendingOrder({ total_price: "100.00" }));
    deductBudget.mockResolvedValue({ success: false, remaining_budget: 10 });

    const result = await svc.createPayment(makePaymentData({ amount: "60.00" }));

    expect(result.statusCode).toBe(400);
    expect(result.message).toMatch(/insufficient/i);
    expect(paymentModel.createPayment).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getMyPayments
// ─────────────────────────────────────────────────────────────────────────────
describe("PaymentService.getMyPayments()", () => {
  it("returns payments for a user", async () => {
    const svc = new PaymentService();
    const payments = [{ id: "p1" }, { id: "p2" }];
    paymentModel.getMyPayments.mockResolvedValue(payments);

    const result = await svc.getMyPayments("user-1");

    expect(result).toEqual(payments);
    expect(paymentModel.getMyPayments).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 error response on DB failure", async () => {
    const svc = new PaymentService();
    paymentModel.getMyPayments.mockRejectedValue(new Error("DB connection lost"));

    const result = await svc.getMyPayments("user-1");

    expect(result.statusCode).toBe(500);
    expect(result.message).toMatch(/DB connection lost/i);
  });
});
