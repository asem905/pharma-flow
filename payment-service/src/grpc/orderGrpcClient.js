import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve proto from monorepo root
const PROTO_PATH = path.resolve(__dirname, "../../../proto/order.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef).order;

// Singleton client — one persistent connection for the lifetime of the process
const client = new proto.OrderService(
    process.env.ORDER_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
    //TODO swap for TLS in production
);

// Promisify so callers can use async/await
export const getOrderById = promisify(client.getOrderById.bind(client));