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

router.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

router.post("/category", validateRole("ADMIN"), validateCategory, createCategory);
router.delete("/category/:id", validateRole("ADMIN"), deleteCategory);
router.put("/category/:id", validateRole("ADMIN"), validateCategory, updateCategory);
router.get("/category/:id", validateRole("ADMIN", "CUSTOMER"), findCategory);
router.get("/category", validateRole("ADMIN", "CUSTOMER"), findAllCategories);

router.post("/product", validateRole("ADMIN"), validateProduct, createProduct);
router.delete("/product/:id", validateRole("ADMIN"), deleteProduct);
router.put("/product/:id", validateRole("ADMIN"), validateProduct, updateProduct);
router.get("/product/:id", validateRole("ADMIN", "CUSTOMER"), findProduct);
router.get("/product", validateRole("ADMIN", "CUSTOMER"), findAllProducts);

export default router;