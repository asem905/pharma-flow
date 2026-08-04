import { prisma } from "../config/db.js";

class OrdersModel {
    async findByIdempotencyKey(idempotencyKey) {
        return await prisma.order.findUnique({
            where: { idempotencyKey },
        });
    }

    async createOrder(userId, idempotencyKey, totalPrice, enrichedItems) {
        return await prisma.order.create({
            data: {
                userId,
                idempotencyKey,
                totalPrice,
                orderItems: { create: enrichedItems },
            },
            include: { orderItems: true },
        });
    }

    async deleteOrder(orderId) {
        return await prisma.order.delete({ where: { id: orderId } });
    }

    async updateOrder(orderId, data) {
        return await prisma.order.update({
            where: { id: orderId },
            data,
            include: { orderItems: true },
        });
    }

    async findOrder(orderId) {
        return await prisma.order.findUnique({
            where: { id: orderId },
            include: { orderItems: true },
        });
    }

    async findAllOrders() {
        return await prisma.order.findMany({
            include: {
                orderItems: true
            },
            orderBy: {
                createdAt: "desc"
            },
        });
    }

    async findOrdersForCustomer(customerId, filters = {}) {
        const { status, fromDate, toDate } = filters;
        const where = { userId: customerId };

        if (status) where.status = status;
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = fromDate;
            if (toDate) where.createdAt.lte = toDate;
        }

        return await prisma.order.findMany({
            where,
            include: { orderItems: true },
            orderBy: { createdAt: "desc" },
        });
    }

    async findById(id) {
        return await prisma.order.findUnique({
            where: { id },
        });
    }
}

export default new OrdersModel();