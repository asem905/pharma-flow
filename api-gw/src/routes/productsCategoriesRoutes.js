import express from "express";
import { apiGwProductController } from "../controllers/apiGwControllers.js";
const productsCategoriesRoutes = express.Router();

//product routes
productsCategoriesRoutes.post("/products", apiGwProductController.createProduct);
productsCategoriesRoutes.delete("/products/:id", apiGwProductController.deleteProduct);
productsCategoriesRoutes.put("/products/:id", apiGwProductController.updateProduct);
productsCategoriesRoutes.get("/products/:id", apiGwProductController.findProduct);
productsCategoriesRoutes.get("/products", apiGwProductController.findAllProducts);

//category routes
productsCategoriesRoutes.post("/categories", apiGwProductController.createCategory);
productsCategoriesRoutes.delete("/categories/:id", apiGwProductController.deleteCategory);
productsCategoriesRoutes.put("/categories/:id", apiGwProductController.updateCategory);
productsCategoriesRoutes.get("/categories/:id", apiGwProductController.findCategory);
productsCategoriesRoutes.get("/categories", apiGwProductController.findAllCategories);

export { productsCategoriesRoutes };