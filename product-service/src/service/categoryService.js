import appError from "../utils/appError.js"
import CategoryModel from "../model/categoryModel.js"

export class CategoryService {
    static async createCategory(data) {
        const category = await CategoryModel.findCategoryByName(data.name);
        if (category) {
            return appError.createErrorResponse("Category already exists", 400, "fail")
        }
        const newCategory = await CategoryModel.createCategory(data);
        if (!newCategory) {
            return appError.createErrorResponse("Failed to create category", 400, "fail")
        }
        return newCategory;
    }

    static async deleteCategory(id) {
        const category = await CategoryModel.findCategory(id);
        if (!category) {
            return appError.createErrorResponse("Category not found", 404, "fail")
        }
        const deletedCategory = await CategoryModel.deleteCategory(id);
        if (!deletedCategory) {
            return appError.createErrorResponse("Failed to delete category", 400, "fail")
        }
        return deletedCategory;
    }
    static async updateCategory(id, data) {
        const category = await CategoryModel.findCategory(id);
        if (!category) {
            return appError.createErrorResponse("Category not found", 404, "fail")
        }
        const updatedCategory = await CategoryModel.updateCategory(id, data);
        if (!updatedCategory) {
            return appError.createErrorResponse("Failed to update category", 400, "fail")
        }
        return updatedCategory;
    }
    static async findCategory(id) {
        const category = await CategoryModel.findCategory(id);
        if (!category) {
            return appError.createErrorResponse("Category not found", 404, "fail")
        }
        return category;
    }
    static async findAllCategories() {
        return await CategoryModel.findAllCategories();
    }
}
