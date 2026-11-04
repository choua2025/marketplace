import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/server/db/generated/prisma/client";
import { env } from "@/server/lib/env";

// Connects with the least-privilege app role (DML only, no DDL -- see
// SPEC.md section 5.7). Migrations/seed use a separate owner-role script
// (prisma.config.ts's DATABASE_URL), never this client.
const adapter = new PrismaPg({ connectionString: env.DATABASE_APP_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Reuse a single instance across Next.js dev-server hot reloads -- each
// PrismaClient owns its own connection pool, and the module graph gets
// re-evaluated on every edit in dev, which would otherwise leak pools.
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
