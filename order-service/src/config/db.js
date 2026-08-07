import { PrismaClient } from "../generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                        // keep pool small — Railway free tier has connection limits
  idleTimeoutMillis: 30000,      // close connections idle > 30s (before Railway kills them silently)
  connectionTimeoutMillis: 5000, // fail fast if can't get a connection in 5s
  keepAlive: true,               // send TCP keepalive packets — prevents Railway from dropping idle connections
  keepAliveInitialDelayMillis: 10000,
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
