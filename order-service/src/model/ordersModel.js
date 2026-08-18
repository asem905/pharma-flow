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

    // Converts the Zod-validated query object into a Prisma where clause.
    // fromDate/toDate are remapped to a createdAt range filter.
    // Every other validated field is spread directly — no manual wiring per param.
    // This means adding a new field to the Zod schema automatically flows through
    // without touching this model so open close principle is maintained.
    #buildWhere(filters = {}, baseWhere = {}) {
        const { fromDate, toDate, ...directFilters } = filters;
        const where = { ...baseWhere, ...directFilters };

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = fromDate;
            if (toDate) where.createdAt.lte = toDate;
        }

        return where;
    }

    async findAllOrders(filters = {}) {
        return await prisma.order.findMany({
            where: this.#buildWhere(filters),
            include: { orderItems: true },
            orderBy: { createdAt: "desc" },
        });
    }

    async findOrdersForCustomer(customerId, filters = {}) {
        return await prisma.order.findMany({
            where: this.#buildWhere(filters, { userId: customerId }),
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