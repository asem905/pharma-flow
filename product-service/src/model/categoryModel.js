import { prisma } from "../config/db.js";

class CategoryModel {
    static async createCategory(data) {
        return await prisma.category.create({
            data
        });
    }
    static async deleteCategory(id) {
        return await prisma.category.delete({
            where: {
                id
            }
        });
    }
    static async updateCategory(id, data) {
        return await prisma.category.update({
            where: {
                id
            },
            data
        });
    }
    static async findCategory(id) {
        return await prisma.category.findUnique({
            where: {
                id
            }
        });
    }
    static async findCategoryByName(name) {
        return await prisma.category.findUnique({
            where: { name }
        });
    }
    static async findAllCategories() {
        return await prisma.category.findMany({
            orderBy: { name: "asc" },
        });
    }
}

export default CategoryModel;