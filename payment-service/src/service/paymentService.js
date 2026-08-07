import paymentModel from "../model/paymentModel.js";
import appError from "../utils/appError.js";
import { getOrderById } from "../grpc/orderGrpcClient.js";
import { deductBudget, reverseBudget } from "../grpc/authGrpcClient.js";
import { publishPaymentSuccess, publishPaymentFailed, publishPaymentOverpaid } from "../events/paymentPublisher.js";
import { performance } from "perf_hooks";

export class PaymentService {
    async createPayment(paymentData) {
        console.log(`[PaymentFlow] Starting payment creation for order ${paymentData.orderId}`);
        const startTime = performance.now();

        let stepStart = performance.now();
        const order = await getOrderById({ order_id: paymentData.orderId });
        console.log(`[PaymentFlow] getOrderById took ${(performance.now() - stepStart).toFixed(2)}ms`);

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
            const retryRefund = await reverseBudget({
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
            const budget = await deductBudget({ user_id: paymentData.userId, amount: shortfall });
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
                console.log(`[PaymentFlow] Finished payment creation in ${(performance.now() - startTime).toFixed(2)}ms (Overpaid)`);
                return { ...results, remainingAmount: overpaymentChange };
            }

            console.log(`[PaymentFlow] Finished payment creation in ${(performance.now() - startTime).toFixed(2)}ms (Success)`);
            //add the budget credits used:
            return {
                ...results,
                budgetCreditsUsed: isUnderpayment ? shortfall : 0,
            };
        } catch (error) {
            console.error(`[PaymentFlow] Payment creation failed after ${(performance.now() - startTime).toFixed(2)}ms: ${error.message}`);
            //  Synchronous RPC reversal instead of fire-and-forget event
            let refundConfirmed = false;

            if (budgetDeducted) {
                const refund_key = `refund:${paymentData.orderId}:${paymentData.userId}:${paymentData.idempotencyKey}`;
                try {
                    stepStart = performance.now();
                    const refund = await reverseBudget({
                        user_id: paymentData.userId,
                        amount: shortfall,
                        refund_key,
                    });
                    console.log(`[PaymentFlow] reverseBudget (rollback) took ${(performance.now() - stepStart).toFixed(2)}ms`);
                    refundConfirmed = refund.success;
                } catch (refundErr) {
                    console.error("[Payment] ReverseBudget RPC failed:", refundErr.message);
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
        const order = await getOrderById({ order_id: orderId });
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