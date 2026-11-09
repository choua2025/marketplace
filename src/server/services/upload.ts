import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import {
  createExpiringViewUrl,
  createSignedUpload,
  createSignedViewUrl,
} from "@/server/storage/cloudinary";
import { createUploadUrlSchema } from "@/lib/validations/upload";
import { isGooglePhotoUrl } from "@/lib/google-photo";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_PORTFOLIO_ITEMS = 30;
// Avatar/portfolio photos are shown on public provider profiles (SPEC.md
// section 7.5), so they get permanent signed CDN URLs that can be cached.
// Everything else (booking/chat photos, verification documents) is private
// and gets a URL that expires.
const PUBLIC_PURPOSES = new Set(["avatar", "portfolio"]);
const PRIVATE_VIEW_TTL_SECONDS = 60 * 60;

export function assertKeyBelongsToActor(key: string, purpose: string, actor: Actor): void {
  if (!key.startsWith(`${purpose}/${actor.id}/`)) {
    throw new AppError("FORBIDDEN");
  }
}

/** Step 1 of SPEC.md section 7.9's upload flow: request signed upload parameters. */
export async function createUploadUrl(
  actor: Actor | null,
  input: unknown,
): Promise<{ uploadUrl: string; fields: Record<string, string>; key: string }> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  // Every upload starts here, so this one limit covers them all.
  await enforceRateLimit("upload", actor.id);

  const parsed = createUploadUrlSchema.parse(input);
  if (parsed.purpose === "portfolio" && actor.role !== "provider") {
    throw new AppError("FORBIDDEN");
  }
  if (parsed.purpose === "booking" && actor.role !== "customer") {
    throw new AppError("FORBIDDEN");
  }
  if (parsed.purpose === "verification" && actor.role !== "provider") {
    throw new AppError("FORBIDDEN");
  }

  const ext = EXTENSION_BY_CONTENT_TYPE[parsed.contentType];
  // Chat images are keyed by conversation (both parties need to view them
  // later), not by the uploader -- verify actor is actually a party first.
  let key: string;
  if (parsed.purpose === "chat") {
    const conversationId = parsed.conversationId!;
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, OR: [{ customerId: actor.id }, { providerId: actor.id }] },
      select: { id: true },
    });
    if (!conversation) throw new AppError("NOT_FOUND");
    key = `chat/${conversationId}/${randomUUID()}.${ext}`;
  } else {
    key = `${parsed.purpose}/${actor.id}/${randomUUID()}.${ext}`;
  }

  const { uploadUrl, fields } = createSignedUpload(key);

  return { uploadUrl, fields, key };
}

/** Step 3: client hands the key back; verify it's really theirs before trusting it. */
export async function confirmAvatarUpload(
  actor: Actor | null,
  key: string,
): Promise<{ avatarKey: string }> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  assertKeyBelongsToActor(key, "avatar", actor);

  await db.profile.update({ where: { id: actor.id }, data: { avatarKey: key } });
  return { avatarKey: key };
}

export async function addPortfolioItem(actor: Actor | null, key: string, caption?: string) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "provider") throw new AppError("FORBIDDEN");
  assertKeyBelongsToActor(key, "portfolio", actor);

  return db.$transaction(async (tx) => {
    const existingCount = await tx.portfolioItem.count({ where: { providerId: actor.id } });

    if (existingCount >= MAX_PORTFOLIO_ITEMS) {
      throw new AppError("PORTFOLIO_FULL");
    }

    return tx.portfolioItem.create({
      data: {
        providerId: actor.id,
        imageKey: key,
        caption: caption ?? null,
        sortOrder: existingCount,
      },
    });
  });
}

export async function removePortfolioItem(actor: Actor | null, itemId: string): Promise<void> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const deleted = await db.portfolioItem.deleteMany({
    where: { id: itemId, providerId: actor.id },
  });

  if (deleted.count === 0) throw new AppError("NOT_FOUND");
}

/** For rendering: converts a stored key into a viewable URL. */
export async function getSignedImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  // A Google sign-in's profile picture, kept until the user uploads their own.
  if (isGooglePhotoUrl(key)) return key;
  const purpose = key.slice(0, key.indexOf("/"));
  return PUBLIC_PURPOSES.has(purpose)
    ? createSignedViewUrl(key)
    : createExpiringViewUrl(key, PRIVATE_VIEW_TTL_SECONDS);
}
