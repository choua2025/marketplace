import { execSync } from "node:child_process";
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

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
