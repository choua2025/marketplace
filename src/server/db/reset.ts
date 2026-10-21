import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file -- rely on vars already present in the environment.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run db:reset (owner-role connection).");
}

// TRUNCATE requires the TRUNCATE privilege, which the app role deliberately
// does not have (SPEC.md section 5.7) -- this connects with the owner role
// instead, never the shared app-role client in ./client.ts.
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

async function main() {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );

  const names = tables.rows.map((row) => `"${row.tablename}"`);
  if (names.length === 0) {
    console.log("No tables found, nothing to reset.");
    return;
  }

  await db.execute(sql.raw(`TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`));
  console.log(`Reset complete: truncated ${names.length} tables.`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Reset failed:", error);
    process.exit(1);
  });
