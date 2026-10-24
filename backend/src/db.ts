import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

let client: PrismaClient | undefined;

/** Lazy initialization keeps the independent API health route database-free. */
export function getDatabaseClient(): PrismaClient {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    max: 5,
  });
  client = new PrismaClient({ adapter, log: [] });
  return client;
}
