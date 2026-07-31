import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve proto from monorepo root
const PROTO_PATH = path.resolve(__dirname, "../../../proto/product.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef).product;

// Singleton client — one persistent connection for the lifetime of the process
const client = new proto.ProductService(
    process.env.PRODUCT_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
    //TODO swap for TLS in production
);

// Promisify so callers can use async/await
export const getProductsInfo = promisify(client.getProductsInfo.bind(client));
export const decrementStock = promisify(client.decrementStock.bind(client));
export const incrementStock = promisify(client.incrementStock.bind(client));
