import { db } from "@/server/db/client";

/** Every active provider's id, for the public sitemap (SPEC.md section 10). */
export async function listActiveProviderIds(): Promise<string[]> {
  const rows = await db.providerProfile.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}
