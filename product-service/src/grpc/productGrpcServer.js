import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";
import { prisma } from "../config/db.js";

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

// ── Handler: GetProductsInfo ─────────────────────────────────────────────────
// Called by order-service to fetch price + stock for a batch of product IDs

async function getProductsInfo(call, callback) {
    const { product_ids } = call.request;
    try {
        //uses bitmapIndexScan for faster retreival of multiple ids
        const products = await prisma.product.findMany({
            where: { id: { in: product_ids } },
            select: { id: true, price: true, stock: true },
        });

        // Build a map for O(1) lookup
        const productMap = new Map(products.map((p) => [p.id, p]));

        const result = product_ids.map((id) => {
            const p = productMap.get(id);
            if (!p) {
                return { product_id: id, found: false, price: "0", stock: 0 };
            }
            return {
                product_id: id,
                found: true,
                // Prisma Decimal → string to preserve precision over the wire
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

// ── Handler: DecrementStock ──────────────────────────────────────────────────
// Called by order-service after price validation.
// Runs inside a Prisma transaction: all decrements succeed or all roll back.

async function decrementStock(call, callback) {
    const { updates } = call.request;
    try {
        await prisma.$transaction(async (tx) => {
            for (const { product_id, quantity } of updates) {
                const product = await tx.product.findUnique({
                    where: { id: product_id },
                    select: { stock: true },
                });

                if (!product) {
                    throw { productId: product_id, message: "Product not found" };
                }

                if (product.stock < quantity) {
                    throw {
                        productId: product_id,
                        message: `Insufficient stock (available: ${product.stock}, requested: ${quantity})`,
                    };
                }

                await tx.product.update({
                    where: { id: product_id },
                    data: { stock: { decrement: quantity } },
                });
            }
        });

        callback(null, { success: true, message: "Stock decremented successfully" });
    } catch (err) {
        // Prisma transaction rolled back automatically on throw
        callback(null, {
            success: false,
            failed_product_id: err.productId ?? "",
            message: err.message ?? "Stock decrement failed",
        });
    }
}

// ── Handler: IncrementStock ──────────────────────────────────────────────────
// Called by order-service when an order is deleted or cancelled.
// Restores the stock that was reserved when the order was originally placed.

async function incrementStock(call, callback) {
    const { updates } = call.request;
    try {
        await prisma.$transaction(async (tx) => {
            for (const { product_id, quantity } of updates) {
                const exists = await tx.product.findUnique({
                    where: { id: product_id },
                    select: { id: true },
                });
                if (!exists) {
                    throw { productId: product_id, message: "Product not found during stock restore" };
                }
                await tx.product.update({
                    where: { id: product_id },
                    data: { stock: { increment: quantity } },
                });
            }
        });
        callback(null, { success: true, message: "Stock restored successfully" });
    } catch (err) {
        callback(null, {
            success: false,
            failed_product_id: err.productId ?? "",
            message: err.message ?? "Stock restore failed",
        });
    }
}


export function startGrpcServer() {
    const server = new grpc.Server();

    server.addService(proto.ProductService.service, {
        getProductsInfo,
        decrementStock,
        incrementStock,
    });

    const GRPC_PORT = process.env.GRPC_PORT;

    server.bindAsync(
        `0.0.0.0:${GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(), // swap for TLS in production
        (err, port) => {
            if (err) {
                console.error("[gRPC] Failed to bind server:", err);
                throw err;
            }
            console.log(`[product-service] gRPC server listening on port ${port}`);
        }
    );
}
