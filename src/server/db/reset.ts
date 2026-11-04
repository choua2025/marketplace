import { Pool } from "pg";

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

async function main() {
  // _prisma_migrations tracks applied migrations in this same schema --
  // truncating it would make `prisma migrate deploy` think none had ever
  // run and try to recreate tables that already exist.
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );

  const names = rows.map((row) => `"${row.tablename}"`);
  if (names.length === 0) {
    console.log("No tables found, nothing to reset.");
    return;
  }

  await pool.query(`TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`);
  console.log(`Reset complete: truncated ${names.length} tables.`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Reset failed:", error);
    process.exit(1);
  });
