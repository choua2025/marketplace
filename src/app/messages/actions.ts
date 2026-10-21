"use server";

import { getActor } from "@/server/auth/session";
import { startConversation } from "@/server/services/chat";
import { toActionResult } from "@/server/actions/result";

export async function startConversationAction(providerId: string) {
  return toActionResult(async () => startConversation(await getActor(), { providerId }));
}
