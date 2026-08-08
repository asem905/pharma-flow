import paymentModel from "../model/paymentModel.js";
import appError from "../utils/appError.js";
import { getOrderById } from "../grpc/orderGrpcClient.js";
import { deductBudget, reverseBudget } from "../grpc/authGrpcClient.js";
import { publishPaymentSuccess, publishPaymentFailed, publishPaymentOverpaid } from "../events/paymentPublisher.js";
import { performance } from "perf_hooks";
import CircuitBreaker from "opossum";
import { circuitBreakerOptions } from "../config/circuitBreaker.config.js";
import logger from "../utils/logger.js";
//====================why circuit breaker====================//
//so now circuit breaker made what?: 
// basically there are 3 states : CLOSED, OPEN, HALF OPEN
//in closed state everything goes normal 
//after some errors it goes to OPEN state and starts fast failing
//after some time i determined, it goes to HALF OPEN state and starts checking if the service is recovered
//if the service is recovered it goes to CLOSED state
//if the service is not recovered it goes to OPEN state
//so now no need to do the grpc call each time instead only
// after returning same response from fallback for amount of time
// it then becomes half open for only one request to check
// if server returns healthy or not
//=================================================================//


// Deduct budget breaker
const deductBudgetBreaker = new CircuitBreaker(deductBudget, circuitBreakerOptions);
deductBudgetBreaker.fallback(() => ({ success: false, __circuitOpen: true }));
deductBudgetBreaker.on("open", () => logger.warn("Circuit OPEN — auth-service unreachable", { breaker: "deductBudget" }));
deductBudgetBreaker.on("halfOpen", () => logger.info("Circuit HALF-OPEN — probing auth-service", { breaker: "deductBudget" }));
deductBudgetBreaker.on("close", () => logger.info("Circuit CLOSED — auth-service recovered", { breaker: "deductBudget" }));
deductBudgetBreaker.on("fallback", () => logger.warn("Circuit fallback triggered", { breaker: "deductBudget" }));
deductBudgetBreaker.on("reject", () => logger.warn("Circuit rejected request", { breaker: "deductBudget" }));

// Reverse budget breaker
const reverseBudgetBreaker = new CircuitBreaker(reverseBudget, circuitBreakerOptions);
reverseBudgetBreaker.fallback(() => ({ success: false, __circuitOpen: true }));
reverseBudgetBreaker.on("open", () => logger.warn("Circuit OPEN — auth-service unreachable", { breaker: "reverseBudget" }));
reverseBudgetBreaker.on("halfOpen", () => logger.info("Circuit HALF-OPEN — probing auth-service", { breaker: "reverseBudget" }));
reverseBudgetBreaker.on("close", () => logger.info("Circuit CLOSED — auth-service recovered", { breaker: "reverseBudget" }));
reverseBudgetBreaker.on("fallback", () => logger.warn("Circuit fallback triggered", { breaker: "reverseBudget" }));
reverseBudgetBreaker.on("reject", () => logger.warn("Circuit rejected request", { breaker: "reverseBudget" }));

// Order-by-ID breaker
const getOrderByIdBreaker = new CircuitBreaker(getOrderById, circuitBreakerOptions);
getOrderByIdBreaker.fallback(() => ({ __circuitOpen: true }));
getOrderByIdBreaker.on("open", () => logger.warn("Circuit OPEN — order-service unreachable", { breaker: "getOrderById" }));
getOrderByIdBreaker.on("halfOpen", () => logger.info("Circuit HALF-OPEN — probing order-service", { breaker: "getOrderById" }));
getOrderByIdBreaker.on("close", () => logger.info("Circuit CLOSED — order-service recovered", { breaker: "getOrderById" }));
getOrderByIdBreaker.on("fallback", () => logger.warn("Circuit fallback triggered", { breaker: "getOrderById" }));
getOrderByIdBreaker.on("reject", () => logger.warn("Circuit rejected request", { breaker: "getOrderById" }));

export class PaymentService {
    async createPayment(paymentData) {
        const startTime = performance.now();

        let stepStart = performance.now();
        let order;
        try {
            order = await getOrderByIdBreaker.fire({ order_id: paymentData.orderId });
        } catch (err) {
            logger.error("gRPC getOrderById failed", { orderId: paymentData.orderId, error: err.message });
            return appError.createErrorResponse("Order service unavailable", 503, "failure");
        }
        console.log(`[PaymentFlow] getOrderById took ${(performance.now() - stepStart).toFixed(2)}ms`);
        if (order?.__circuitOpen) {
            logger.warn("Payment blocked — order-service circuit is OPEN", { orderId: paymentData.orderId });
            return appError.createErrorResponse("Order service unavailable", 503, "failure");
        }

        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "failure");
        } else if (order.user_id != paymentData.userId) {
            return appError.createErrorResponse("You are not authorized to create payment for this order", 403, "failure");
        } else if (order.status !== "PENDING") {
            return appError.createErrorResponse(`Order not in pending state but it is: ${order.status}`, 400, "failure");
        }

        const orderTotal = parseFloat(order.total_price);
        const paidAmount = parseFloat(paymentData.amount);
        const isUnderpayment = paidAmount < orderTotal;
        const shortfall = isUnderpayment ? parseFloat((orderTotal - paidAmount).toFixed(2)) : 0;
        const overpaymentChange = !isUnderpayment ? parseFloat((paidAmount - orderTotal).toFixed(2)) : 0;

        //  Idempotency check ─
        stepStart = performance.now();
        // 1. Successful payment already exists → return it immediately (no double-charge).
        const existing = await paymentModel.getPaymentByIdempotencyKey(paymentData.idempotencyKey);
        if (existing && existing.status === "SUCCESS") {
            console.log(`[PaymentFlow] Idempotency check (success) took ${(performance.now() - stepStart).toFixed(2)}ms`);
            return existing;
        }

        // 2. A prior attempt failed but the budget reversal is still unresolved.
        //    Piggyback the retry: try to finish the refund inline before proceeding.
        const pendingRefund = await paymentModel.getFailedPaymentWithPendingRefund(paymentData.idempotencyKey);
        if (pendingRefund) {
            console.log(`[PaymentFlow] Found pending refund for idempotency key ${paymentData.idempotencyKey}`);
            const refund_key = `refund:${paymentData.orderId}:${paymentData.userId}:${paymentData.idempotencyKey}`;
            const retryRefund = await reverseBudgetBreaker.fire({
                user_id: paymentData.userId,
                // refundAmount on the failure satellite is what was actually deducted from budget
                amount: parseFloat(pendingRefund.refundAmount),
                refund_key,
            }).catch(() => ({ success: false }));

            if (retryRefund.success) {
                await paymentModel.markRefundResolved(pendingRefund.id);
                console.log(`[PaymentFlow] Resolved pending refund inline`);
                // fall through — prior refund resolved, allow this attempt to proceed
            } else {
                console.log(`[PaymentFlow] Idempotency check (pending refund failed) took ${(performance.now() - stepStart).toFixed(2)}ms`);
                return appError.createErrorResponse(
                    "A previous payment attempt is still being reconciled. Please retry shortly.",
                    409,
                    "failure"
                );
            }
        }
        console.log(`[PaymentFlow] Idempotency check total took ${(performance.now() - stepStart).toFixed(2)}ms`);

        //  Budget deduction (underpayment shortfall only) 
        let budgetDeducted = false;

        if (isUnderpayment) {
            stepStart = performance.now();
            const budget = await deductBudgetBreaker.fire({ user_id: paymentData.userId, amount: shortfall });
            console.log(`[PaymentFlow] deductBudget took ${(performance.now() - stepStart).toFixed(2)}ms`);
            if (!budget.success) {
                return appError.createErrorResponse(
                    `Insufficient budget and Payment amount is insufficient. Order total is ${orderTotal}, but you paid ${paidAmount} and your remaining budget is ${budget.remaining_budget}.`,
                    400,
                    "failure"
                );
            }
            budgetDeducted = true;
        }

        try {
            stepStart = performance.now();
            const { email, ...dbPayload } = paymentData;
            const results = await paymentModel.createPayment(dbPayload);
            console.log(`[PaymentFlow] createPayment (DB) took ${(performance.now() - stepStart).toFixed(2)}ms`);

            publishPaymentSuccess(results, email, isUnderpayment ? 0 : overpaymentChange);

            if (overpaymentChange > 0) {
                publishPaymentOverpaid(results, email, overpaymentChange);
                logger.info("Payment completed — overpaid", {
                    paymentId: results.id,
                    orderId: paymentData.orderId,
                    userId: paymentData.userId,
                    paid: paidAmount,
                    orderTotal,
                    change: overpaymentChange,
                    durationMs: (performance.now() - startTime).toFixed(2),
                });
                return { ...results, remainingAmount: overpaymentChange };
            }

            logger.info("Payment completed — success", {
                paymentId: results.id,
                orderId: paymentData.orderId,
                userId: paymentData.userId,
                paid: paidAmount,
                budgetCreditsUsed: isUnderpayment ? shortfall : 0,
                durationMs: (performance.now() - startTime).toFixed(2),
            });
            return {
                ...results,
                budgetCreditsUsed: isUnderpayment ? shortfall : 0,
            };
        } catch (error) {
            logger.error("Payment creation failed", {
                orderId: paymentData.orderId,
                userId: paymentData.userId,
                error: error.message,
                durationMs: (performance.now() - startTime).toFixed(2),
            });
            let refundConfirmed = false;

            if (budgetDeducted) {
                const refund_key = `refund:${paymentData.orderId}:${paymentData.userId}:${paymentData.idempotencyKey}`;
                try {
                    stepStart = performance.now();
                    const refund = await reverseBudgetBreaker.fire({
                        user_id: paymentData.userId,
                        amount: shortfall,
                        refund_key,
                    });
                    console.log(`[PaymentFlow] reverseBudget (rollback) took ${(performance.now() - stepStart).toFixed(2)}ms`);
                    refundConfirmed = refund.success;
                    if (refundConfirmed) {
                        logger.info("Budget rolled back after payment failure", {
                            orderId: paymentData.orderId,
                            userId: paymentData.userId,
                            amount: shortfall,
                        });
                    } else {
                        logger.warn("Budget rollback returned success=false after payment failure", {
                            orderId: paymentData.orderId,
                            userId: paymentData.userId,
                            amount: shortfall,
                        });
                    }
                } catch (refundErr) {
                    logger.error("Budget rollback RPC failed after payment failure", {
                        orderId: paymentData.orderId,
                        userId: paymentData.userId,
                        error: refundErr.message,
                    });
                }
            }

            // Persist a FAILED audit row atomically — fire-and-forget, don't block the response.
            // createFailedPayment handles Payment + PaymentFailure in a single transaction.
            const { email, idempotencyKey, ...dbPayload } = paymentData;
            paymentModel.createFailedPayment({
                paymentData: dbPayload,
                idempotencyKey,
                failureReason: error.message.slice(0, 255),
                refundAmount: budgetDeducted ? shortfall : null,
                refundStatus: budgetDeducted ? (refundConfirmed ? "REFUNDED" : "PENDING") : null,
            }).catch(saveErr =>
                console.error("[Payment] Could not persist FAILED record:", saveErr.message)
            );

            publishPaymentFailed(paymentData, paymentData.email);
            return appError.createErrorResponse(error.message, 500, "failure");
        }
    }
    async getMyPayments(userId) {
        try {
            const results = await paymentModel.getMyPayments(userId);
            return results;
        } catch (error) {
            return appError.createErrorResponse(error.message, 500, "failure");
        }
    }

    async getPaymentByOrderId(orderId, currentUser) {
        const order = await getOrderByIdBreaker.fire({ order_id: orderId });
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "failure");
        } else if (order.user_id != currentUser.id && currentUser.role !== "ADMIN") {
            return appError.createErrorResponse("You are not authorized to view this payment", 403, "failure");
        } else {
            try {
                const results = await paymentModel.getPaymentByOrderId(orderId);
                return results;
            } catch (error) {
                return appError.createErrorResponse(error.message, 500, "failure");
            }
        }
    }

    async getPaymentById(paymentId, currentUser) {
        try {
            const payment = await paymentModel.getPaymentById(paymentId);
            if (!payment) {
                return appError.createErrorResponse("Payment not found", 404, "failure");
            }
            if (payment.userId != currentUser.id && currentUser.role != "ADMIN") {
                return appError.createErrorResponse("You are not authorized to view this payment", 403, "failure");
            }
            return payment;
        } catch (error) {
            return appError.createErrorResponse(error.message, 500, "failure");
        }
    }
}