import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/server/db/generated/prisma/client";
import { loadTestEnv } from "./load-test-env";

loadTestEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to run integration tests.`);
  return value;
}

const ownerAdapter = new PrismaPg({ connectionString: requireEnv("DATABASE_TEST_URL") });
const appAdapter = new PrismaPg({ connectionString: requireEnv("DATABASE_TEST_APP_URL") });

// Owner role (DDL rights) -- test setup/teardown only, mirrors DATABASE_URL
// in production tooling. Never used to exercise service-layer behavior.
export const testOwnerDb = new PrismaClient({ adapter: ownerAdapter });

// App role (DML only, no DDL) -- the same least-privilege connection the
// real server uses, so integration tests faithfully exercise the actual
// permission boundary described in SPEC.md section 5.7.
export const testDb = new PrismaClient({ adapter: appAdapter });

/** Truncates every table in the public schema. Call in beforeEach. */
export async function resetTestDatabase(): Promise<void> {
  // _prisma_migrations tracks applied migrations in this same schema --
  // truncating it would make the next test run think none had ever run.
  const tables = await testOwnerDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const names = tables.map((row) => `"${row.tablename}"`);
  if (names.length === 0) return;

  await testOwnerDb.$executeRawUnsafe(
    `TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`,
  );
}

export async function closeTestDatabase(): Promise<void> {
  await Promise.all([testOwnerDb.$disconnect(), testDb.$disconnect()]);
}
