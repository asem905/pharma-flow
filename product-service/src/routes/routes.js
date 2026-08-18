import express from "express";

import {
    createProduct,
    deleteProduct,
    updateProduct,
    findProduct,
    findAllProducts
} from "../controller/productsController.js";
import {
    createCategory,
    deleteCategory,
    updateCategory,
    findCategory,
    findAllCategories
} from "../controller/categoryController.js";
import { validateProduct, validateCategory } from "../middlewares/productCategoryValidn.js";
import { validateRole } from "../middlewares/validateRole.js";

const router = express.Router();

router.post("/categories", validateRole("ADMIN"), validateCategory, createCategory);
router.delete("/categories/:id", validateRole("ADMIN"), deleteCategory);
router.put("/categories/:id", validateRole("ADMIN"), validateCategory, updateCategory);
router.get("/categories/:id", validateRole("ADMIN", "CUSTOMER"), findCategory);
router.get("/categories", validateRole("ADMIN", "CUSTOMER"), findAllCategories);

router.post("/products", validateRole("ADMIN"), validateProduct, createProduct);
router.delete("/products/:id", validateRole("ADMIN"), deleteProduct);
router.put("/products/:id", validateRole("ADMIN"), validateProduct, updateProduct);
router.get("/products/:id", validateRole("ADMIN", "CUSTOMER"), findProduct);
router.get("/products", validateRole("ADMIN", "CUSTOMER"), findAllProducts);

export default router;