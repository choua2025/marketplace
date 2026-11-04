import { defineConfig, env } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // .env not present (e.g. CI sets vars directly) -- fall through and let
  // Prisma's own "DATABASE_URL required" error surface instead of ENOENT.
}

// Owner-role connection (DDL rights) -- same DATABASE_URL drizzle-kit used.
// The running app connects separately with the least-privilege DATABASE_APP_URL
// (see src/server/db/client.ts); this file only drives the Prisma CLI.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/server/db/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
