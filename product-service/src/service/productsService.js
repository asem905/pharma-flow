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
//and this prevent race condition that may occcur if i made with each request 
//as imagine:
//Request A updates Product 2
//Request B updates Product 3
// Both read the old list.
// Each writes its own version.
// One update overwrites the other.
// Example:
// List: [P1, P2, P3]

// Request A reads → gets [P1, P2, P3]
// Request B reads → gets [P1, P2, P3]

// A updates P2 → sends [P1, P2', P3]
// B updates P3 → sends [P1, P2, P3']

// If B writes last → P2' is lost.
// If A writes last → P3' is lost.

// Result: Inconsistent state

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
        try {
            const newProduct = await ProductsModel.createProduct(data);
            updateCacheAsync(() => cacheService.del(KEYS.all()));
            return newProduct;
        } catch (err) {
            console.error("[ProductsService] createProduct failed:", err.message);
            return appError.createErrorResponse("Failed to create product", 500, "fail");
        }
    }

    static async deleteProduct(id) {
        const product = await ProductsModel.findProduct(id);
        if (!product) {
            return appError.createErrorResponse("Product not found", 404, "fail")
        }
        try {
            const deletedProduct = await ProductsModel.deleteProduct(id);
            updateCacheAsync(() => cacheService.del(KEYS.one(id), KEYS.all()));
            return deletedProduct;
        } catch (err) {
            console.error("[ProductsService] deleteProduct failed:", err.message);
            return appError.createErrorResponse("Failed to delete product", 500, "fail");
        }
    }

    static async updateProduct(id, data) {
        const product = await ProductsModel.findProduct(id);
        if (!product) {
            return appError.createErrorResponse("Product not found", 404, "fail")
        }
        try {
            const updatedProduct = await ProductsModel.updateProduct(id, data);
            updateCacheAsync(() => cacheService.del(KEYS.one(id), KEYS.all()));
            return updatedProduct;
        } catch (err) {
            console.error("[ProductsService] updateProduct failed:", err.message);
            return appError.createErrorResponse("Failed to update product", 500, "fail");
        }
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