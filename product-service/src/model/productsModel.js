import { prisma } from "../config/db.js";

class ProductsModel {

    static async createProduct(data) {
        return await prisma.product.create({
            data
        });
    }
    static async deleteProduct(id) {
        return await prisma.product.delete({
            where: {
                id
            }
        });
    }
    static async updateProduct(id, data) {
        return await prisma.product.update({
            where: {
                id
            },
            data
        });
    }
    static async findProduct(id) {
        return await prisma.product.findUnique({
            where: { id },
            include: { category: true },
        });
    }
    static async findProductByName(name) {
        return await prisma.product.findUnique({
            where: { name }
        });
    }
    static async findAllProducts() {
        return await prisma.product.findMany({
            include: { category: true },
            orderBy: { createdAt: "desc" },
        });
    }

    // ── gRPC batch helpers ──────────────────────────────────────────────────────

    // Fetch id + price + stock for a list of IDs in one query
    static async findManyByIds(ids) {
        return await prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, price: true, stock: true },
        });
    }

    // Single-statement batch decrement — one DB round trip
    // items: [{ product_id, quantity }]
    static async batchDecrementStock(items) {
        const valuesString = items
            .map((i) => `('${i.product_id}', ${i.quantity})`)
            .join(", ");
        return await prisma.$executeRawUnsafe(`
            UPDATE "products" AS p
            SET stock = p.stock - v.quantity
            FROM (VALUES ${valuesString}) AS v(id, quantity)
            WHERE p.id = CAST(v.id AS text)
        `);
    }

    // Single-statement batch increment — one DB round trip
    // items: [{ product_id, quantity }]
    static async batchIncrementStock(items) {
        const valuesString = items
            .map((i) => `('${i.product_id}', ${i.quantity})`)
            .join(", ");
        return await prisma.$executeRawUnsafe(`
            UPDATE "products" AS p
            SET stock = p.stock + v.quantity
            FROM (VALUES ${valuesString}) AS v(id, quantity)
            WHERE p.id = CAST(v.id AS text)
        `);
    }

}

export default ProductsModel;
