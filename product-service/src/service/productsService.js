import ProductsModel from "../model/productsModel.js"
import appError from "../utils/appError.js"
export class ProductsService {
    static async createProduct(data) {
        const product = await ProductsModel.findProductByName(data.name);
        if (product) {
            return appError.createErrorResponse("Product already exists", 400, "fail")
        }
        const newProduct = await ProductsModel.createProduct(data);
        if (!newProduct) {
            return appError.createErrorResponse("Failed to create product", 400, "fail")
        }
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
        return updatedProduct;
    }
    static async findProduct(id) {
        const product = await ProductsModel.findProduct(id);
        if (!product) {
            return appError.createErrorResponse("Product not found", 404, "fail")
        }
        return product;
    }
    static async findAllProducts() {
        return await ProductsModel.findAllProducts();
    }
}