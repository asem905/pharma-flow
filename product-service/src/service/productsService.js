import ProductsModel from "../model/productsModel.js"
import appError from "../utils/appError.js"
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
    all: () => "products:all",
    one: (id) => `products:${id}`,
};

const updateCacheAsync = (fn) => {
    fn().catch(err => console.error("Background cache update failed:", err));
};

export class ProductsService {
    static async createProduct(data) {
        const existing = await ProductsModel.findProductByName(data.name);
        if (existing) {
            return appError.createErrorResponse("Product already exists", 400, "fail")
        }
        const newProduct = await ProductsModel.createProduct(data);
        if (!newProduct) {
            return appError.createErrorResponse("Failed to create product", 400, "fail")
        }
        updateCacheAsync(() => cacheService.del(KEYS.all()));
        return newProduct;
    }

    static async deleteProduct(id) {
        const product = await ProductsModel.findProduct(id);
        if (!product) {
            return appError.createErrorResponse("Product not found", 404, "fail")
        }
        const deletedProduct = await ProductsModel.deleteProduct(id);
        if (!deletedProduct) {
            return appError.createErrorResponse("Failed to delete product", 400, "fail")
        }
        updateCacheAsync(() => cacheService.del(KEYS.one(id), KEYS.all()));
        return deletedProduct;
    }

    static async updateProduct(id, data) {
        const product = await ProductsModel.findProduct(id);
        if (!product) {
            return appError.createErrorResponse("Product not found", 404, "fail")
        }
        const updatedProduct = await ProductsModel.updateProduct(id, data);
        if (!updatedProduct) {
            return appError.createErrorResponse("Failed to update product", 400, "fail")
        }
        updateCacheAsync(() => cacheService.del(KEYS.one(id), KEYS.all()));
        return updatedProduct;
    }

    static async findProduct(id) {
        const cached = await cacheService.get(KEYS.one(id));
        if (cached) return cached;

        const product = await ProductsModel.findProduct(id);
        if (!product) {
            return appError.createErrorResponse("Product not found", 404, "fail")
        }
        updateCacheAsync(() => cacheService.set(KEYS.one(id), product));
        return product;
    }

    static async findAllProducts() {
        const cached = await cacheService.get(KEYS.all());
        if (cached) return cached;

        const products = await ProductsModel.findAllProducts();
        updateCacheAsync(() => cacheService.set(KEYS.all(), products));
        return products;
    }
}