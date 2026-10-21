import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversations, portfolioItems, profiles } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import { createPresignedUploadUrl, createPresignedViewUrl } from "@/server/storage/s3";
import { createUploadUrlSchema } from "@/lib/validations/upload";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_PORTFOLIO_ITEMS = 30;
// Avatar/portfolio photos are shown on public provider profiles (SPEC.md
// section 7.5) -- unlike booking/chat photos they aren't truly private,
// but everything still goes through signed URLs since the storage bucket
// itself is locked down to no anonymous access (see docker/garage). A
// longer TTL than the booking/chat 10 minutes is enough for a page view.
const PUBLIC_IMAGE_VIEW_TTL_SECONDS = 60 * 60;

function assertKeyBelongsToActor(key: string, purpose: string, actor: Actor): void {
  if (!key.startsWith(`${purpose}/${actor.id}/`)) {
    throw new AppError("FORBIDDEN");
  }
}

/** Step 1 of SPEC.md section 7.9's upload flow: request a presigned PUT URL. */
export async function createUploadUrl(
  actor: Actor | null,
  input: unknown,
): Promise<{ uploadUrl: string; key: string }> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const parsed = createUploadUrlSchema.parse(input);
  if (parsed.purpose === "portfolio" && actor.role !== "provider") {
    throw new AppError("FORBIDDEN");
  }
  if (parsed.purpose === "booking" && actor.role !== "customer") {
    throw new AppError("FORBIDDEN");
  }

  const ext = EXTENSION_BY_CONTENT_TYPE[parsed.contentType];
  // Chat images are keyed by conversation (both parties need to view them
  // later), not by the uploader -- verify actor is actually a party first.
  let key: string;
  if (parsed.purpose === "chat") {
    const conversationId = parsed.conversationId!;
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.customerId, actor.id), eq(conversations.providerId, actor.id)),
        ),
      );
    if (!conversation) throw new AppError("NOT_FOUND");
    key = `chat/${conversationId}/${randomUUID()}.${ext}`;
  } else {
    key = `${parsed.purpose}/${actor.id}/${randomUUID()}.${ext}`;
  }

  const uploadUrl = await createPresignedUploadUrl(key, parsed.contentType, parsed.contentLength);

  return { uploadUrl, key };
}

/** Step 3: client hands the key back; verify it's really theirs before trusting it. */
export async function confirmAvatarUpload(
  actor: Actor | null,
  key: string,
): Promise<{ avatarKey: string }> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  assertKeyBelongsToActor(key, "avatar", actor);

  await db.update(profiles).set({ avatarKey: key }).where(eq(profiles.id, actor.id));
  return { avatarKey: key };
}

export async function addPortfolioItem(actor: Actor | null, key: string, caption?: string) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "provider") throw new AppError("FORBIDDEN");
  assertKeyBelongsToActor(key, "portfolio", actor);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: portfolioItems.id })
      .from(portfolioItems)
      .where(eq(portfolioItems.providerId, actor.id));

    if (existing.length >= MAX_PORTFOLIO_ITEMS) {
      throw new AppError("PORTFOLIO_FULL");
    }

    const [item] = await tx
      .insert(portfolioItems)
      .values({
        providerId: actor.id,
        imageKey: key,
        caption: caption ?? null,
        sortOrder: existing.length,
      })
      .returning();

    if (!item) throw new Error("failed to insert portfolio item");
    return item;
  });
}

export async function removePortfolioItem(actor: Actor | null, itemId: string): Promise<void> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const [deleted] = await db
    .delete(portfolioItems)
    .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.providerId, actor.id)))
    .returning({ id: portfolioItems.id });

  if (!deleted) throw new AppError("NOT_FOUND");
}

/** For rendering: converts a stored key into a short-lived viewable URL. */
export async function getSignedImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedViewUrl(key, PUBLIC_IMAGE_VIEW_TTL_SECONDS);
}
