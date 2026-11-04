"use server";

import { getActor } from "@/server/auth/session";
import { addFavorite, removeFavorite } from "@/server/services/favorite";
import { toActionResult } from "@/server/actions/result";

export async function addFavoriteAction(providerId: string) {
  return toActionResult(async () => addFavorite(await getActor(), providerId));
}

export async function removeFavoriteAction(providerId: string) {
  return toActionResult(async () => removeFavorite(await getActor(), providerId));
}
