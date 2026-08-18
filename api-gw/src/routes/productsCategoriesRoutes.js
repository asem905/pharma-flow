import express from "express";
import { apiGwProductController } from "../controllers/apiGwControllers.js";

const productsCategoriesRoutes = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Product catalogue management
 *   - name: Categories
 *     description: Product category management
 */

// ─── Products ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product (ADMIN only)
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductRequest'
 *     responses:
 *       201:
 *         description: Product created
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden
 */
productsCategoriesRoutes.post("/products", apiGwProductController.createProduct);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Array of products
 */
productsCategoriesRoutes.get("/products", apiGwProductController.findAllProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product found
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
productsCategoriesRoutes.get("/products/:id", apiGwProductController.findProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product (ADMIN only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductRequest'
 *     responses:
 *       200:
 *         description: Product updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
productsCategoriesRoutes.put("/products/:id", apiGwProductController.updateProduct);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product (ADMIN only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
productsCategoriesRoutes.delete("/products/:id", apiGwProductController.deleteProduct);

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a category (ADMIN only)
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryRequest'
 *     responses:
 *       201:
 *         description: Category created
 *       403:
 *         description: Forbidden
 */
productsCategoriesRoutes.post("/categories", apiGwProductController.createCategory);

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List all categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Array of categories
 */
productsCategoriesRoutes.get("/categories", apiGwProductController.findAllCategories);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get a category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category found
 *       404:
 *         description: Not found
 */
productsCategoriesRoutes.get("/categories/:id", apiGwProductController.findCategory);

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     summary: Update a category (ADMIN only)
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryRequest'
 *     responses:
 *       200:
 *         description: Category updated
 *       403:
 *         description: Forbidden
 */
productsCategoriesRoutes.put("/categories/:id", apiGwProductController.updateCategory);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Delete a category (ADMIN only)
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted
 *       403:
 *         description: Forbidden
 */
productsCategoriesRoutes.delete("/categories/:id", apiGwProductController.deleteCategory);

export { productsCategoriesRoutes };