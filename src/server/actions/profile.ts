"use server";

import { getActor } from "@/server/auth/session";
import { becomeProvider, setShowOnHomepage, updatePersonalInfo } from "@/server/services/profile";
import { confirmAvatarUpload } from "@/server/services/upload";
import { toActionResult } from "@/server/actions/result";

// Personal info and profile photo work for any signed-in user (customer or provider).
export async function updatePersonalInfoAction(input: unknown) {
  return toActionResult(async () => updatePersonalInfo(await getActor(), input));
}

export async function setShowOnHomepageAction(show: unknown) {
  return toActionResult(async () => setShowOnHomepage(await getActor(), show));
}

export async function confirmAvatarUploadAction(key: string) {
  return toActionResult(async () => confirmAvatarUpload(await getActor(), key));
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function becomeProviderAction(): Promise<ActionResult> {
  try {
    const actor = await getActor();
    await becomeProvider(actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
  }
}
