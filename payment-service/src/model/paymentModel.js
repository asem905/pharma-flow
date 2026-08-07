import { prisma } from "../config/db.js";

class PaymentModel {

    // ── Core payment reads ───────────────────────────────────────────────────────

    async createPayment(data) {
        return await prisma.payment.create({ data });
    }

    async getMyPayments(userId) {
        return await prisma.payment.findMany({
            where: { userId },
            include: { failure: true },
        });
    }

    async getPaymentByOrderId(orderId) {
        return await prisma.payment.findMany({
            where: { orderId },
            include: { failure: true },
        });
    }

    async getPaymentById(id) {
        return await prisma.payment.findUnique({
            where: { id },
            include: { failure: true },
        });
    }

    async getPaymentByIdempotencyKey(key) {
        return await prisma.payment.findUnique({
            where: { idempotencyKey: key },
        });
    }

    async updatePaymentStatus(id, status) {
        return await prisma.payment.update({ where: { id }, data: { status } });
    }

    async deletePayment(id) {
        return await prisma.payment.delete({ where: { id } });
    }

    // ── Failure + refund lifecycle ───────────────────────────────────────────────

    // Atomically persists the FAILED payment and its satellite failure record.
    async createFailedPayment({ paymentData, idempotencyKey, failureReason, refundAmount, refundStatus }) {
        return await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    ...paymentData,
                    idempotencyKey: `${idempotencyKey}-failed-${Date.now()}`,
                    status: "FAILED",
                },
            });

            await tx.paymentFailure.create({
                data: {
                    paymentId: payment.id,
                    originalIdempotencyKey: idempotencyKey,
                    failureReason,
                    refundAmount: refundAmount ?? null,
                    refundStatus: refundStatus ?? null,
                },
            });

            return payment;
        });
    }

    // Returns the satellite failure record (with its parent payment) for a given
    // original idempotency key that still has an unresolved budget refund.
    async getFailedPaymentWithPendingRefund(originalIdempotencyKey) {
        return await prisma.paymentFailure.findFirst({
            where: { originalIdempotencyKey, refundStatus: "PENDING" },
            include: { payment: true },
            orderBy: { createdAt: "desc" },
        });
    }

    async markRefundResolved(failureId) {
        return await prisma.paymentFailure.update({
            where: { id: failureId },
            data: { refundStatus: "REFUNDED" },
        });
    }

    async incrementRefundAttempt(failureId) {
        return await prisma.paymentFailure.update({
            where: { id: failureId },
            data: { refundAttempts: { increment: 1 } },
        });
    }

    // Returns failure records with a PENDING refund that are old enough
    // and haven't exceeded the retry cap.
    async getPendingRefunds({ olderThanMinutes = 5, maxAttempts = 5 } = {}) {
        const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        return await prisma.paymentFailure.findMany({
            where: {
                refundStatus: "PENDING",
                refundAttempts: { lt: maxAttempts },
                createdAt: { lt: cutoff },
            },
            include: { payment: true },
        });
    }
}

export default new PaymentModel();