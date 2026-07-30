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
            where: {
                id
            }
        });
    }
    static async findProductByName(name) {
        return await prisma.product.findUnique({
            where: { name }
        });
    }
    static async findAllProducts() {
        return await prisma.product.findMany();
    }

}

export default ProductsModel;
