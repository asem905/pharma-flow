import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import { fileURLToPath } from "url";
import UsersModel from "../model/usersModel.js";
import RefundLedgerModel from "../model/refundLedgerModel.js";
import { prisma } from "../config/db.js"; // used only for $transaction

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_PATH = path.resolve(__dirname, "../../../proto/auth.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

const getUserById = async (call, callback) => {
    try {
        const { user_id } = call.request;
        const user = await UsersModel.findById(user_id);

        if (!user) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: "User not found",
            });
        }

        callback(null, {
            id: user.id,
            email: user.email,
            role: user.role,
            budget: user.budget || 0,
        });
    } catch (error) {
        callback({
            code: grpc.status.INTERNAL,
            message: error.message,
        });
    }
};

const deductBudget = async (call, callback) => {
    try {
        const { user_id, amount } = call.request;
        const user = await UsersModel.findById(user_id);

        if (!user) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: "User not found",
            });
        }

        console.log("user budget============", user.budget);
        console.log("amount==============", amount);
        const currentBudget = user.budget || 0;
        if (currentBudget < amount) {
            return callback(null, {
                success: false,
                message: `Insufficient budget. Available: ${currentBudget}, Required: ${amount}`,
                remaining_budget: currentBudget
            });
        }

        // Atomically decrement budget
        const updatedUser = await UsersModel.update(user_id, {
            budget: { decrement: amount }
        });

        callback(null, {
            success: true,
            message: "Budget deducted successfully",
            remaining_budget: updatedUser.budget
        });
    } catch (error) {
        callback({
            code: grpc.status.INTERNAL,
            message: error.message,
        });
    }
};

const reverseBudget = async (call, callback) => {
    try {
        const { user_id, amount, refund_key } = call.request;

        // Idempotency check — if this refund_key already landed, return success without crediting again.
        const existing = await RefundLedgerModel.findByKey(refund_key);
        if (existing) {
            const user = await UsersModel.findById(user_id);
            return callback(null, {
                success: true,
                message: "Already applied (idempotent)",
                remaining_budget: user?.budget || 0,
            });
        }

        // Write the ledger row and credit the budget atomically.
        // Interactive transaction form is used so we can call model methods
        // without leaking raw PrismaPromises out of the model layer.
        const updatedUser = await prisma.$transaction(async (tx) => {
            await tx.refund_ledger.create({ data: { refund_key, user_id, amount } });
            return tx.users.update({
                where: { id: user_id },
                data: { budget: { increment: amount } },
            });
        });

        console.log(`[Auth gRPC] ReverseBudget | userId=${user_id} +${amount} | key=${refund_key}`);
        callback(null, {
            success: true,
            message: "Budget reversed successfully",
            remaining_budget: updatedUser.budget,
        });
    } catch (error) {
        callback({
            code: grpc.status.INTERNAL,
            message: error.message,
        });
    }
};

export const startAuthGrpcServer = () => {
    const server = new grpc.Server();
    server.addService(authProto.AuthService.service, {
        GetUserById: getUserById,
        DeductBudget: deductBudget,
        ReverseBudget: reverseBudget,
    });

    // Auth service gRPC running on 50053
    const port = "50053";
    server.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
            if (error) {
                console.error("[auth-service] Failed to bind gRPC server:", error);
                return;
            }
            console.log(`[auth-service] gRPC server listening on port ${port}`);
        }
    );
};
