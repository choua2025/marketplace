import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadTestEnv } from "./load-test-env";

// Runs once before the whole test run: applies pending migrations to
// changdee_test using the owner role (DDL rights), the same way
// `pnpm db:migrate` does for the dev database.
export async function setup() {
  loadTestEnv();

  const databaseUrl = process.env.DATABASE_TEST_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_TEST_URL is required to run integration tests.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });

  await pool.end();
}
