import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/server/lib/env";
import * as schema from "./schema";

// Connects with the least-privilege app role (DML only, no DDL -- see
// SPEC.md section 5.7). Migrations/seed use a separate owner-role script,
// never this client.
const pool = new Pool({ connectionString: env.DATABASE_APP_URL });

export const db = drizzle(pool, { schema });
