import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { loadTestEnv } from "./load-test-env";
import * as schema from "@/server/db/schema";

loadTestEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to run integration tests.`);
  return value;
}

const ownerPool = new Pool({ connectionString: requireEnv("DATABASE_TEST_URL") });
const appPool = new Pool({ connectionString: requireEnv("DATABASE_TEST_APP_URL") });

// Owner role (DDL rights) -- test setup/teardown only, mirrors DATABASE_URL
// in production tooling. Never used to exercise service-layer behavior.
export const testOwnerDb = drizzle(ownerPool, { schema });

// App role (DML only, no DDL) -- the same least-privilege connection the
// real server uses, so integration tests faithfully exercise the actual
// permission boundary described in SPEC.md section 5.7.
export const testDb = drizzle(appPool, { schema });

/** Truncates every table in the public schema. Call in beforeEach. */
export async function resetTestDatabase(): Promise<void> {
  const tables = await testOwnerDb.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const names = tables.rows.map((row) => `"${row.tablename}"`);
  if (names.length === 0) return;

  await testOwnerDb.execute(sql.raw(`TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`));
}

export async function closeTestDatabase(): Promise<void> {
  await Promise.all([ownerPool.end(), appPool.end()]);
}
