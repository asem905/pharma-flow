import { prisma } from "../config/db.js";

class PaymentModel {
    async createPayment(data) {
        return await prisma.payment.create({ data });
    }
    async getMyPayments(userId) {
        return await prisma.payment.findMany({ where: { userId } });
    }
    async getPaymentByOrderId(orderId) {
        return await prisma.payment.findMany({ where: { orderId } });
    }
    async getPaymentById(id) {
        return await prisma.payment.findUnique({ where: { id } });
    }
    async getPaymentByIdempotencyKey(key) {
        return await prisma.payment.findUnique({ where: { idempotencyKey: key } });
    }
    async updatePaymentStatus(id, status) {
        return await prisma.payment.update({ where: { id }, data: { status } });
    }
    async getPaymentByEmail(email) {
        return await prisma.payment.findMany({ where: { email } });
    }
    async deletePayment(id) {
        return await prisma.payment.delete({ where: { id } });
    }
}

export default new PaymentModel();