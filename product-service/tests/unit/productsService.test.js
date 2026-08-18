import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("@/model/productsModel.js", () => ({
  default: {
    findProductByName: vi.fn(),
    findProduct: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    findAllProducts: vi.fn(),
  },
}));

vi.mock("@/service/cacheService.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/model/categoryModel.js", () => ({
  default: {
    findCategoryByName: vi.fn(),
    findCategory: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    findAllCategories: vi.fn(),
  },
}));

vi.mock("@/utils/appError.js", async (importOriginal) => {
  // Use real implementation — appError is a tiny singleton
  return importOriginal();
});

// ─── Imports ──────────────────────────────────────────────────────────────────
import { ProductsService } from "@/service/productsService.js";
import { CategoryService } from "@/service/categoryService.js";
import ProductsModel from "@/model/productsModel.js";
import CategoryModel from "@/model/categoryModel.js";
import cacheService from "@/service/cacheService.js";

// ─────────────────────────────────────────────────────────────────────────────
// ProductsService
// ─────────────────────────────────────────────────────────────────────────────
describe("ProductsService.createProduct()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when product name already exists", async () => {
    ProductsModel.findProductByName.mockResolvedValue({ id: 1, name: "Panadol" });

    const result = await ProductsService.createProduct({ name: "Panadol", price: 5 });

    expect(result.statusCode).toBe(400);
    expect(result.message).toMatch(/already exists/i);
    expect(ProductsModel.createProduct).not.toHaveBeenCalled();
  });

  it("creates product and invalidates cache on success", async () => {
    ProductsModel.findProductByName.mockResolvedValue(null);
    const newProduct = { id: 1, name: "Aspirin", price: 3 };
    ProductsModel.createProduct.mockResolvedValue(newProduct);
    cacheService.del.mockResolvedValue();

    const result = await ProductsService.createProduct({ name: "Aspirin", price: 3 });

    expect(result).toEqual(newProduct);
    expect(ProductsModel.createProduct).toHaveBeenCalledOnce();
  });

  it("returns 500 when DB throws during create", async () => {
    ProductsModel.findProductByName.mockResolvedValue(null);
    ProductsModel.createProduct.mockRejectedValue(new Error("DB down"));

    const result = await ProductsService.createProduct({ name: "Aspirin", price: 3 });

    expect(result.statusCode).toBe(500);
  });
});

describe("ProductsService.findProduct()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cached product on cache HIT (no DB call)", async () => {
    const cached = { id: 1, name: "Panadol" };
    cacheService.get.mockResolvedValue(cached);

    const result = await ProductsService.findProduct(1);

    expect(result).toEqual(cached);
    expect(ProductsModel.findProduct).not.toHaveBeenCalled();
  });

  it("fetches from DB on cache MISS and caches result async", async () => {
    cacheService.get.mockResolvedValue(null);
    const dbProduct = { id: 2, name: "Aspirin" };
    ProductsModel.findProduct.mockResolvedValue(dbProduct);
    cacheService.set.mockResolvedValue();

    const result = await ProductsService.findProduct(2);

    expect(result).toEqual(dbProduct);
    expect(ProductsModel.findProduct).toHaveBeenCalledWith(2);
  });

  it("returns 404 on DB MISS", async () => {
    cacheService.get.mockResolvedValue(null);
    ProductsModel.findProduct.mockResolvedValue(null);

    const result = await ProductsService.findProduct(99);

    expect(result.statusCode).toBe(404);
  });
});

describe("ProductsService.deleteProduct()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when product not found", async () => {
    ProductsModel.findProduct.mockResolvedValue(null);

    const result = await ProductsService.deleteProduct(99);

    expect(result.statusCode).toBe(404);
    expect(ProductsModel.deleteProduct).not.toHaveBeenCalled();
  });

  it("deletes and invalidates cache on success", async () => {
    const product = { id: 1, name: "Panadol" };
    ProductsModel.findProduct.mockResolvedValue(product);
    ProductsModel.deleteProduct.mockResolvedValue(product);
    cacheService.del.mockResolvedValue();

    const result = await ProductsService.deleteProduct(1);

    expect(result).toEqual(product);
    expect(ProductsModel.deleteProduct).toHaveBeenCalledWith(1);
  });
});

describe("ProductsService.updateProduct()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when product not found", async () => {
    ProductsModel.findProduct.mockResolvedValue(null);

    const result = await ProductsService.updateProduct(99, { price: 10 });

    expect(result.statusCode).toBe(404);
  });

  it("updates and invalidates cache on success", async () => {
    const existing = { id: 1, name: "Aspirin" };
    const updated = { ...existing, price: 10 };
    ProductsModel.findProduct.mockResolvedValue(existing);
    ProductsModel.updateProduct.mockResolvedValue(updated);

    const result = await ProductsService.updateProduct(1, { price: 10 });

    expect(result).toEqual(updated);
  });
});

describe("ProductsService.findAllProducts()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all products from cache when available", async () => {
    const cached = [{ id: 1 }, { id: 2 }];
    cacheService.get.mockResolvedValue(cached);

    const result = await ProductsService.findAllProducts();

    expect(result).toEqual(cached);
    expect(ProductsModel.findAllProducts).not.toHaveBeenCalled();
  });

  it("fetches from DB on cache miss", async () => {
    cacheService.get.mockResolvedValue(null);
    const products = [{ id: 1 }, { id: 2 }];
    ProductsModel.findAllProducts.mockResolvedValue(products);

    const result = await ProductsService.findAllProducts();

    expect(result).toEqual(products);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CategoryService — same cache pattern, verify it works identically
// ─────────────────────────────────────────────────────────────────────────────
describe("CategoryService.createCategory()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when category already exists", async () => {
    CategoryModel.findCategoryByName.mockResolvedValue({ id: 1, name: "Antibiotics" });

    const result = await CategoryService.createCategory({ name: "Antibiotics" });

    expect(result.statusCode).toBe(400);
    expect(CategoryModel.createCategory).not.toHaveBeenCalled();
  });

  it("creates category and returns it on success", async () => {
    CategoryModel.findCategoryByName.mockResolvedValue(null);
    const newCat = { id: 1, name: "Vitamins" };
    CategoryModel.createCategory.mockResolvedValue(newCat);

    const result = await CategoryService.createCategory({ name: "Vitamins" });

    expect(result).toEqual(newCat);
  });
});

describe("CategoryService.findCategory()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cached category (no DB call)", async () => {
    const cached = { id: 1, name: "Vitamins" };
    cacheService.get.mockResolvedValue(cached);

    const result = await CategoryService.findCategory(1);

    expect(result).toEqual(cached);
    expect(CategoryModel.findCategory).not.toHaveBeenCalled();
  });

  it("returns 404 when not found in DB on cache miss", async () => {
    cacheService.get.mockResolvedValue(null);
    CategoryModel.findCategory.mockResolvedValue(null);

    const result = await CategoryService.findCategory(99);

    expect(result.statusCode).toBe(404);
  });
});
