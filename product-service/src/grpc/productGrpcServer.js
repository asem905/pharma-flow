import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";
import ProductsModel from "../model/productsModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve proto file from monorepo root
const PROTO_PATH = path.resolve(__dirname, "../../../proto/product.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef).product;

// ── Handler: GetProductsInfo ──────────────────────────────────────────────────
// Still used by updateOrder (needs prices for the delta items only)

async function getProductsInfo(call, callback) {
    const { product_ids } = call.request;
    try {
        const products = await ProductsModel.findManyByIds(product_ids);
        const productMap = new Map(products.map((p) => [p.id, p]));

        const result = product_ids.map((id) => {
            const p = productMap.get(id);
            if (!p) return { product_id: id, found: false, price: "0", stock: 0 };
            return {
                product_id: id,
                found: true,
                price: p.price.toString(),
                stock: p.stock,
            };
        });

        callback(null, { products: result });
    } catch (err) {
        console.error("[gRPC] getProductsInfo error:", err);
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

// ── Handler: ValidateAndReserveStock ─────────────────────────────────────────
// Replaces getProductsInfo + decrementStock for order creation.
// 2 DB round trips total (was 2N+1):
//   1. findManyByIds  — batch fetch all products at once
//   2. batchDecrementStock — batch decrement all products at once
// Validates existence + stock in-memory (no extra DB queries).

async function validateAndReserveStock(call, callback) {
    const { items } = call.request;
    try {
        const productIds = items.map((i) => i.product_id);

        // 1. Single findMany — one DB round trip for all products
        const products = await ProductsModel.findManyByIds(productIds);
        const productMap = new Map(products.map((p) => [p.id, p]));

        // 2. Validate existence + stock in-memory
        for (const { product_id, quantity } of items) {
            const p = productMap.get(product_id);
            if (!p) {
                return callback(null, {
                    success: false,
                    failed_product_id: product_id,
                    message: "Product not found",
                    reserved: [],
                });
            }
            if (p.stock < quantity) {
                return callback(null, {
                    success: false,
                    failed_product_id: product_id,
                    message: `Insufficient stock (available: ${p.stock}, requested: ${quantity})`,
                    reserved: [],
                });
            }
        }

        // 3. Batch decrement — single raw SQL UPDATE, one DB round trip
        await ProductsModel.batchDecrementStock(items);

        // 4. Build response with snapshotted prices for order-service
        const reserved = items.map((i) => ({
            product_id: i.product_id,
            price: productMap.get(i.product_id).price.toString(),
            quantity: i.quantity,
        }));

        callback(null, { success: true, message: "Stock reserved", reserved });
    } catch (err) {
        console.error("[gRPC] validateAndReserveStock error:", err);
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

// ── Handler: DecrementStock ───────────────────────────────────────────────────
// Used by updateOrder when item quantities INCREASE (delta > 0).
// Optimized: 1 findManyByIds + 1 batchDecrementStock (was N findUnique + N update).

async function decrementStock(call, callback) {
    const { updates } = call.request;
    try {
        const productIds = updates.map((u) => u.product_id);

        // 1. Batch fetch — one DB round trip
        const products = await ProductsModel.findManyByIds(productIds);
        const productMap = new Map(products.map((p) => [p.id, p]));

        // 2. Validate in-memory
        for (const { product_id, quantity } of updates) {
            const p = productMap.get(product_id);
            if (!p) {
                return callback(null, {
                    success: false,
                    failed_product_id: product_id,
                    message: "Product not found",
                });
            }
            if (p.stock < quantity) {
                return callback(null, {
                    success: false,
                    failed_product_id: product_id,
                    message: `Insufficient stock (available: ${p.stock}, requested: ${quantity})`,
                });
            }
        }

        // 3. Batch decrement — single raw SQL, one DB round trip
        await ProductsModel.batchDecrementStock(updates);

        callback(null, { success: true, message: "Stock decremented successfully" });
    } catch (err) {
        console.error("[gRPC] decrementStock error:", err);
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

// ── Handler: IncrementStock ───────────────────────────────────────────────────
// Not used directly anymore (stock restores go via RabbitMQ).
// Kept for any direct callers / future use.

async function incrementStock(call, callback) {
    const { updates } = call.request;
    try {
        const productIds = updates.map((u) => u.product_id);

        const products = await ProductsModel.findManyByIds(productIds);
        const foundIds = new Set(products.map((p) => p.id));

        for (const { product_id } of updates) {
            if (!foundIds.has(product_id)) {
                return callback(null, {
                    success: false,
                    failed_product_id: product_id,
                    message: "Product not found during stock restore",
                });
            }
        }

        await ProductsModel.batchIncrementStock(updates);

        callback(null, { success: true, message: "Stock restored successfully" });
    } catch (err) {
        console.error("[gRPC] incrementStock error:", err);
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

export function startGrpcServer() {
    const server = new grpc.Server();

    server.addService(proto.ProductService.service, {
        getProductsInfo,
        validateAndReserveStock,
        decrementStock,
        incrementStock,
    });

    const GRPC_PORT = process.env.GRPC_PORT;

    server.bindAsync(
        `0.0.0.0:${GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                console.error("[gRPC] Failed to bind server:", err);
                throw err;
            }
            console.log(`[product-service] gRPC server listening on port ${port}`);
        }
    );
}
