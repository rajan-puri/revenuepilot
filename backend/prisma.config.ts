import { defineConfig } from "prisma/config";

// npm scripts load .env through Node. Runtime traffic uses the pooled
// DATABASE_URL; Prisma CLI operations prefer Neon's direct connection.
const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() ??
  process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
