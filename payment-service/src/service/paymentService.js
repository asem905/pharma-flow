import paymentModel from "../model/paymentModel.js";
import appError from "../utils/appError.js";
import { getOrderById } from "../grpc/orderGrpcClient.js";
import { publishPaymentSuccess, publishPaymentFailed, publishPaymentRefunded } from "../events/paymentPublisher.js";
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
            try {
                const results = await paymentModel.create(paymentData);
                // email is threaded from the controller via paymentData
                publishPaymentSuccess(results, paymentData.email);
                return results;
            }
            catch (error) {
                publishPaymentFailed(paymentData, paymentData.email);
                return appError.createErrorResponse(error.message, 500, "failure");
            }
        }
    }
    async getMyPayments(userId) {
        try {
            const results = await paymentModel.find({
                where: {
                    userId: userId
                }
            });
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
                const results = await paymentModel.find({
                    where: {
                        orderId: orderId
                    }
                });
                return results;
            }
            catch (error) {
                return appError.createErrorResponse(error.message, 500, "failure");
            }
        }
    }
    async getPaymentById(paymentId, currentUser) {
        try {
            const payment = await paymentModel.find({
                where: {
                    id: paymentId
                }
            });
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