import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { providerProfiles } from "@/server/db/schema";

/** Every active provider's id, for the public sitemap (SPEC.md section 10). */
export async function listActiveProviderIds(): Promise<string[]> {
  const rows = await db
    .select({ id: providerProfiles.id })
    .from(providerProfiles)
    .where(eq(providerProfiles.isActive, true));

  return rows.map((row) => row.id);
}
