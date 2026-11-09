import { z } from "zod";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { assertKeyBelongsToActor } from "@/server/services/upload";

const submitVerificationSchema = z.object({
  documentKeys: z.array(z.string().min(1)).min(1).max(5),
  note: z.string().trim().max(500).optional(),
});

function assertProvider(actor: Actor | null): Actor {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "provider") throw new AppError("FORBIDDEN");
  return actor;
}

function assertAdmin(actor: Actor | null): Actor {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "admin") throw new AppError("FORBIDDEN");
  return actor;
}

export interface VerificationDto {
  providerId: string;
  documentKeys: string[];
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
}

/**
 * Submits (or resubmits) identity/business documents for review (SPEC
 * extension: provider verification). Resubmitting after a rejection always
 * resets the request to pending -- there is no verification history, just
 * the current state.
 */
export async function submitVerification(
  actor: Actor | null,
  input: unknown,
): Promise<VerificationDto> {
  const provider = assertProvider(actor);
  await enforceRateLimit("verification", provider.id);
  const parsed = submitVerificationSchema.parse(input);
  for (const key of parsed.documentKeys) {
    assertKeyBelongsToActor(key, "verification", provider);
  }

  return db.providerVerification.upsert({
    where: { providerId: provider.id },
    create: {
      providerId: provider.id,
      documentKeys: parsed.documentKeys,
      note: parsed.note ?? null,
      status: "pending",
    },
    update: {
      documentKeys: parsed.documentKeys,
      note: parsed.note ?? null,
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    },
  });
}

/** The calling provider's own verification request, if any. */
export async function getMyVerification(actor: Actor | null): Promise<VerificationDto | null> {
  const provider = assertProvider(actor);
  return db.providerVerification.findUnique({ where: { providerId: provider.id } });
}

export interface AdminVerificationListItemDto {
  providerId: string;
  displayName: string;
  documentKeys: string[];
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
}

/** Admin: every verification request, optionally filtered by status, oldest first. */
export async function listVerifications(
  actor: Actor | null,
  status?: "pending" | "approved" | "rejected",
): Promise<AdminVerificationListItemDto[]> {
  assertAdmin(actor);

  const rows = await db.providerVerification.findMany({
    where: status ? { status } : {},
    orderBy: { submittedAt: "asc" },
    select: {
      providerId: true,
      documentKeys: true,
      note: true,
      status: true,
      submittedAt: true,
      provider: { select: { displayName: true } },
    },
  });

  return rows.map((row) => ({
    providerId: row.providerId,
    displayName: row.provider.displayName,
    documentKeys: row.documentKeys,
    note: row.note,
    status: row.status,
    submittedAt: row.submittedAt,
  }));
}

/**
 * Admin: approves or rejects a pending verification request. Approving
 * flips `provider_profiles.is_verified` in the same transaction; a
 * rejection reason is required when rejecting.
 */
export async function reviewVerification(
  actor: Actor | null,
  providerId: string,
  decision: { approve: boolean; rejectionReason?: string },
): Promise<void> {
  const admin = assertAdmin(actor);

  if (!decision.approve && !decision.rejectionReason?.trim()) {
    throw new AppError("VALIDATION_ERROR", "A rejection reason is required.");
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.providerVerification.updateMany({
      where: { providerId, status: "pending" },
      data: {
        status: decision.approve ? "approved" : "rejected",
        reviewedAt: new Date(),
        reviewedBy: admin.id,
        rejectionReason: decision.approve ? null : decision.rejectionReason!.trim(),
      },
    });
    if (updated.count === 0) throw new AppError("NOT_FOUND");

    if (decision.approve) {
      await tx.providerProfile.update({ where: { id: providerId }, data: { isVerified: true } });
    }
  });
}
