import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";
dotenv.config();

// Parse DATABASE_URL into individual connection options
// Format: mysql://user:password@host:port/database
const url = new URL(process.env.DATABASE_URL);

const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace("/", ""),
    connectionLimit: 5,
    connectTimeout: 10000,
    acquireTimeout: 10000,       // wait up to 10s to acquire a connection from the pool
    idleTimeout: 30000,          // release connections idle > 30s before Railway kills them
    keepAliveDelay: 10000,       // send keepalive every 10s to hold the TCP connection open
});

export const prisma = new PrismaClient({ adapter });
