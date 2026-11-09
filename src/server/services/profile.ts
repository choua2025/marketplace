import { z } from "zod";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { updatePersonalInfoSchema } from "@/lib/validations/profile";

export interface PersonalInfoDto {
  fullName: string;
  email: string;
  /** Contact phone shown to customers after a booking is confirmed. */
  phone: string | null;
  lineId: string | null;
  avatarKey: string | null;
  /** Agreed to have their photo shown on the public homepage. */
  showOnHomepage: boolean;
}

/** The signed-in user's own personal details, for the profile settings page. */
export async function getMyPersonalInfo(actor: Actor | null): Promise<PersonalInfoDto> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const row = await db.profile.findUnique({
    where: { id: actor.id },
    select: {
      fullName: true,
      avatarKey: true,
      showOnHomepage: true,
      user: { select: { email: true, phoneNumber: true } },
      contact: { select: { phone: true, lineId: true } },
    },
  });
  if (!row) throw new AppError("NOT_FOUND");

  return {
    fullName: row.fullName,
    email: row.user.email,
    // Until a contact phone is saved, suggest the one given at sign-up.
    phone: row.contact?.phone ?? row.user.phoneNumber ?? null,
    lineId: row.contact?.lineId ?? null,
    avatarKey: row.avatarKey,
    showOnHomepage: row.showOnHomepage,
  };
}

/** Opt in to (or out of) showing the signed-in user's photo on the public homepage. */
export async function setShowOnHomepage(actor: Actor | null, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await enforceRateLimit("profileUpdate", actor.id);
  const showOnHomepage = z.boolean().parse(input);
  await db.profile.update({ where: { id: actor.id }, data: { showOnHomepage } });
  return { showOnHomepage };
}

/**
 * Updates the signed-in user's name and contact details. The name is kept
 * in sync on both `profiles` (what the app displays) and Better Auth's
 * `user` table; empty phone/LINE values clear them.
 */
export async function updatePersonalInfo(actor: Actor | null, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await enforceRateLimit("profileUpdate", actor.id);
  const { fullName, phone, lineId } = updatePersonalInfoSchema.parse(input);

  const contact = { phone: phone || null, lineId: lineId || null };
  await db.$transaction([
    db.profile.update({ where: { id: actor.id }, data: { fullName } }),
    db.user.update({ where: { id: actor.id }, data: { name: fullName } }),
    db.profileContact.upsert({
      where: { id: actor.id },
      create: { id: actor.id, ...contact },
      update: contact,
    }),
  ]);

  return { fullName, ...contact };
}

export interface ActorSummaryDto {
  fullName: string;
  avatarKey: string | null;
}

/** Display name + avatar for the signed-in actor -- used by the site header's user menu. */
export async function getActorSummary(actor: Actor | null): Promise<ActorSummaryDto | null> {
  if (!actor) return null;
  return db.profile.findUnique({
    where: { id: actor.id },
    select: { fullName: true, avatarKey: true },
  });
}

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

  await db.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({
      where: { id: actor.id },
      select: { fullName: true },
    });
    if (!profile) throw new AppError("NOT_FOUND");

    await tx.profile.update({ where: { id: actor.id }, data: { role: "provider" } });

    await tx.providerProfile.upsert({
      where: { id: actor.id },
      create: {
        id: actor.id,
        displayName: profile.fullName.length >= 2 ? profile.fullName : "ช่างใหม่",
      },
      update: {},
    });
  });

  return { role: "provider" };
}
