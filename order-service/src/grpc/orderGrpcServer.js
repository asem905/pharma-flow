import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";
import ordersModel from "../model/ordersModel.js"
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve proto file from monorepo root
const PROTO_PATH = path.resolve(__dirname, "../../../proto/order.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef).order;
const GetOrderById = async (call, callback) => {
    try {
        const order = await ordersModel.findById(call.request.order_id);
        if (!order) {
            callback({ code: grpc.status.NOT_FOUND, message: "Order not found" });
            return;
        }
        callback(null, {
            order_id: order.id,
            user_id: order.userId,
            status: order.status,
            total_price: order.totalPrice.toString(),
        });
    }
    catch (error) {
        console.error("[gRPC] GetOrderById error:", error);
        callback({ code: grpc.status.INTERNAL, message: error.message });
    }
};


export function startGrpcServer() {
    const server = new grpc.Server();

    server.addService(proto.OrderService.service, {
        GetOrderById: GetOrderById
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
            console.log(`[order-service] gRPC server listening on port ${port}`);
        }
    );
}

