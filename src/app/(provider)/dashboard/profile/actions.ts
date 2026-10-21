"use server";

import { getActor } from "@/server/auth/session";
import {
  setAvailabilityRules,
  setProviderCategories,
  updateProviderProfile,
} from "@/server/services/provider";
import {
  addPortfolioItem,
  confirmAvatarUpload,
  createUploadUrl,
  removePortfolioItem,
} from "@/server/services/upload";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
  return fn()
    .then((data) => ({ ok: true as const, data }))
    .catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    }));
}

export async function updateProviderProfileAction(input: unknown) {
  return toResult(async () => updateProviderProfile(await getActor(), input));
}

export async function setProviderCategoriesAction(input: unknown) {
  return toResult(async () => setProviderCategories(await getActor(), input));
}

export async function setAvailabilityRulesAction(input: unknown) {
  return toResult(async () => setAvailabilityRules(await getActor(), input));
}

export async function createUploadUrlAction(input: unknown) {
  return toResult(async () => createUploadUrl(await getActor(), input));
}

export async function confirmAvatarUploadAction(key: string) {
  return toResult(async () => confirmAvatarUpload(await getActor(), key));
}

export async function addPortfolioItemAction(key: string, caption?: string) {
  return toResult(async () => addPortfolioItem(await getActor(), key, caption));
}

export async function removePortfolioItemAction(itemId: string) {
  return toResult(async () => removePortfolioItem(await getActor(), itemId));
}
