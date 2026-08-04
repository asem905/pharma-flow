import paymentModel from "../model/paymentModel.js";
import appError from "../utils/appError.js";
import { getOrderById } from "../grpc/orderGrpcClient.js";
import { publishPaymentSuccess, publishPaymentFailed, publishPaymentRefunded, publishPaymentOverpaid } from "../events/paymentPublisher.js";
export class PaymentService {
    async createPayment(paymentData) {
        const order = await getOrderById({ order_id: paymentData.orderId });
        // Guard: check existence BEFORE accessing any property
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "failure");
        } else if (order.user_id != paymentData.userId) {
            // proto uses keepCase:true → field is user_id, not userId
            return appError.createErrorResponse("You are not authorized to create payment for this order", 403, "failure");
        } else if (order.status !== "PENDING") {
            return appError.createErrorResponse("Order not in pending state", 400, "failure");
        } else {
            const orderTotal = parseFloat(order.total_price);
            const paidAmount = parseFloat(paymentData.amount);

            // Underpayment — reject early, no payment record created
            if (paidAmount < orderTotal) {
                return appError.createErrorResponse(
                    `Payment amount is insufficient. Order total is ${orderTotal}, but you paid ${paidAmount}.`,
                    400,
                    "failure"
                );
            }

            // Idempotency check — if a SUCCESS record already exists for this key, return it
            // This protects against double charges on network retries / duplicate requests
            const existing = await paymentModel.getPaymentByIdempotencyKey(paymentData.idempotencyKey);
            if (existing && existing.status === "SUCCESS") {
                return existing; // safe to return cached result, no double charge
            }

            const remainingAmount = parseFloat((paidAmount - orderTotal).toFixed(2));

            try {
                const { email, ...dbPayload } = paymentData;
                const results = await paymentModel.createPayment(dbPayload);

                publishPaymentSuccess(results, email, remainingAmount);

                // Overpayment: separate event so auth-service consumer can credit the user's budget
                if (remainingAmount > 0) {
                    publishPaymentOverpaid(results, email, remainingAmount);
                    return { ...results, remainingAmount };
                }

                return results;
            }
            catch (error) {
                // Store a FAILED record for audit trail — fire-and-forget, don't block the response
                // IMPORTANT: idempotencyKey is intentionally excluded so retries with the same
                // key are not blocked by the unique constraint on that column
                const { email, idempotencyKey, ...dbPayload } = paymentData;
                paymentModel.createPayment({
                    ...dbPayload,
                    status: "FAILED",
                    failureReason: error.message.slice(0, 255),
                }).catch(saveErr =>
                    console.error("[Payment] Could not persist FAILED record:", saveErr.message)
                );

                publishPaymentFailed(paymentData, paymentData.email);
                return appError.createErrorResponse(error.message, 500, "failure");
            }
        }
    }
    async getMyPayments(userId) {
        try {
            const results = await paymentModel.getMyPayments(userId);
            return results;
        }
        catch (error) {
            return appError.createErrorResponse(error.message, 500, "failure");
        }
    }
    async getPaymentByOrderId(orderId, currentUser) {
        // Verify order existence and ownership via gRPC before querying payments
        const order = await getOrderById({ order_id: orderId });
        if (!order) {
            return appError.createErrorResponse("Order not found", 404, "failure");
        } else if (order.user_id != currentUser.id && currentUser.role !== "ADMIN") {
            // proto uses keepCase:true → field is user_id, not userId
            return appError.createErrorResponse("You are not authorized to view this payment", 403, "failure");
        } else {
            try {
                const results = await paymentModel.getPaymentByOrderId(orderId);
                return results;
            }
            catch (error) {
                return appError.createErrorResponse(error.message, 500, "failure");
            }
        }
    }
    async getPaymentById(paymentId, currentUser) {
        try {
            const payment = await paymentModel.getPaymentById(paymentId);
            if (payment.userId != currentUser.id && currentUser.role != "ADMIN") {
                return appError.createErrorResponse("You are not authorized to view this payment", 403, "failure");
            }
            return payment;
        }
        catch (error) {
            return appError.createErrorResponse(error.message, 500, "failure");
        }
    }
}