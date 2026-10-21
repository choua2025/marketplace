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
  removePortfolioItem,
} from "@/server/services/upload";
import { toActionResult } from "@/server/actions/result";

export async function updateProviderProfileAction(input: unknown) {
  return toActionResult(async () => updateProviderProfile(await getActor(), input));
}

export async function setProviderCategoriesAction(input: unknown) {
  return toActionResult(async () => setProviderCategories(await getActor(), input));
}

export async function setAvailabilityRulesAction(input: unknown) {
  return toActionResult(async () => setAvailabilityRules(await getActor(), input));
}

export async function confirmAvatarUploadAction(key: string) {
  return toActionResult(async () => confirmAvatarUpload(await getActor(), key));
}

export async function addPortfolioItemAction(key: string, caption?: string) {
  return toActionResult(async () => addPortfolioItem(await getActor(), key, caption));
}

export async function removePortfolioItemAction(itemId: string) {
  return toActionResult(async () => removePortfolioItem(await getActor(), itemId));
}
