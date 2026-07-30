import { prisma } from "../config/db.js";

class ProductsModel {

    static async createProduct(data) {
        return await prisma.products.create({
            data
        });
    }
    static async deleteProduct(id) {
        return await prisma.products.delete({
            where: {
                id
            }
        });
    }
    static async updateProduct(id, data) {
        return await prisma.products.update({
            where: {
                id
            },
            data
        });
    }
    static async findProduct(id) {
        return await prisma.products.findUnique({
            where: {
                id
            }
        });
    }
    static async findProductByName(name) {
        return await prisma.products.findUnique({
            where: { name }
        });
    }
    static async findAllProducts() {
        return await prisma.products.findMany();
    }

}

export default ProductsModel;
