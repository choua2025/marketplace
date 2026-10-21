import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { profiles, providerProfiles } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";

/**
 * Upgrades a customer to a provider (SPEC.md section 7.1). Used both right
 * after signup (when the signup form's role choice is "provider") and
 * later for a customer upgrading on their own. Idempotent if already a
 * provider. `role` can never come from client input here -- callers only
 * ever pass `actor`, so there is no path for a client to set role=admin.
 */
export async function becomeProvider(actor: Actor | null): Promise<{ role: "provider" }> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role === "admin") throw new AppError("FORBIDDEN");

  await db.transaction(async (tx) => {
    const [profile] = await tx
      .update(profiles)
      .set({ role: "provider" })
      .where(eq(profiles.id, actor.id))
      .returning({ fullName: profiles.fullName });
    if (!profile) throw new AppError("NOT_FOUND");

    await tx
      .insert(providerProfiles)
      .values({
        id: actor.id,
        displayName: profile.fullName.length >= 2 ? profile.fullName : "ช่างใหม่",
      })
      .onConflictDoNothing();
  });

  return { role: "provider" };
}
