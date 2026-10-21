"use server";

import { getActor } from "@/server/auth/session";
import { becomeProvider } from "@/server/services/profile";

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
