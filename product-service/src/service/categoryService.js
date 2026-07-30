import appError from "../utils/appError.js"
import CategoryModel from "../model/categoryModel.js"
import cacheService from "./cacheService.js"
// Cache Invalidation Pattern Used:
//
// After any CREATE, UPDATE, or DELETE operation,
// we invalidate (delete) the affected cache entries.
//
// We do NOT immediately rebuild the cache.
// Instead, the next read request experiences a cache miss,
// fetches fresh data from the database,
// stores it in Redis,
// and returns the result.
//
// This keeps Redis simple and avoids stale or inconsistent cached data.

const KEYS = {
    all: () => "categories:all",
    one: (id) => `categories:${id}`,
};

const updateCacheAsync = (fn) => {
    fn().catch(err => console.error("Background cache update failed:", err));
};

export class CategoryService {
    static async createCategory(data) {
        const existing = await CategoryModel.findCategoryByName(data.name);
        if (existing) {
            return appError.createErrorResponse("Category already exists", 400, "fail")
        }
        const newCategory = await CategoryModel.createCategory(data);
        if (!newCategory) {
            return appError.createErrorResponse("Failed to create category", 400, "fail")
        }
        updateCacheAsync(() => cacheService.del(KEYS.all()));
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
        updateCacheAsync(() => cacheService.del(KEYS.one(id), KEYS.all()));
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
        updateCacheAsync(() => cacheService.del(KEYS.one(id), KEYS.all()));
        return updatedCategory;
    }

    static async findCategory(id) {
        const cached = await cacheService.get(KEYS.one(id));
        if (cached) return cached;

        const category = await CategoryModel.findCategory(id);
        if (!category) {
            return appError.createErrorResponse("Category not found", 404, "fail")
        }
        updateCacheAsync(() => cacheService.set(KEYS.one(id), category));
        return category;
    }

    static async findAllCategories() {
        const cached = await cacheService.get(KEYS.all());
        if (cached) return cached;

        const categories = await CategoryModel.findAllCategories();
        updateCacheAsync(() => cacheService.set(KEYS.all(), categories));
        return categories;
    }
}
