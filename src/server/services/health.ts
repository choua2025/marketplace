import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/** Resolves if Postgres answers a trivial query; rejects otherwise. */
export async function checkDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}
