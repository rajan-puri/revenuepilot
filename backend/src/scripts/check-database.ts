import { getDatabaseClient } from "../db.js";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "Database check not run: set a real DATABASE_URL in backend/.env or your environment.",
    );
    process.exitCode = 1;
    return;
  }

  let client: ReturnType<typeof getDatabaseClient> | undefined;
  try {
    client = getDatabaseClient();
    const result = await client.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    if (result[0]?.ok !== 1) throw new Error("Unexpected database response.");
    console.log(
      "Database connection verified: PostgreSQL SELECT 1 succeeded. Schema migration status is checked separately with npm run db:status.",
    );
  } catch {
    // Driver/Prisma errors may include connection details; do not print them.
    console.error(
      "Database check failed. Verify DATABASE_URL, PostgreSQL availability, and TLS/network settings. No connection details were logged.",
    );
    process.exitCode = 1;
  } finally {
    await client?.$disconnect();
  }
}

void main().catch(() => {
  console.error(
    "Database check could not complete. No connection details were logged.",
  );
  process.exitCode = 1;
});
