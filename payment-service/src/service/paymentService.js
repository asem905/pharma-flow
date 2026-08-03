import paymentModel from "../model/paymentModel.js";
import appError from "../utils/appError.js";
export class PaymentService {
    async createPayment(paymentData) {
        try {
            const results = await paymentModel.create(paymentData);
            return results;
        }
        catch (error) {
            return appError.createErrorResponse(error.message, 500, "failure");
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
        //now we need to check if the order belongs to the current user and if not if he is admin so he can still view it
        if (currentUser.role == "ADMIN") {
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
        //now if he is not admin he should be the owner of the order so we need to check by talking to order service first by grpc

    }
    async getPaymentById(paymentId) {
        try {
            const results = await paymentModel.find({
                where: {
                    id: paymentId
                }
            });
            return results;
        }
        catch (error) {
            return appError.createErrorResponse(error.message, 500, "failure");
        }
    }
}