import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

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
const target = process.env.AUTH_SERVICE_GRPC_URL || "localhost:50053";

const client = new authProto.AuthService(
    target,
    grpc.credentials.createInsecure()
);

export const getUserById = (request) => {
    return new Promise((resolve, reject) => {
        client.GetUserById(request, (error, response) => {
            if (error) {
                if (error.code === grpc.status.NOT_FOUND) resolve(null);
                else reject(error);
            } else {
                resolve(response);
            }
        });
    });
};

export const deductBudget = (request) => {
    return new Promise((resolve, reject) => {
        client.DeductBudget(request, (error, response) => {
            if (error) reject(error);
            else resolve(response);
        });
    });
};

export const reverseBudget = (request) => {
    return new Promise((resolve, reject) => {
        client.ReverseBudget(request, (error, response) => {
            if (error) reject(error);
            else resolve(response);
        });
    });
};
