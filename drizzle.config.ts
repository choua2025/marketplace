import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  // .env not present (e.g. CI sets vars directly) -- fall through and let
  // the DATABASE_URL check below give a clear error instead of ENOENT.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required to run drizzle-kit (owner-role connection, see .env.example).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
});
