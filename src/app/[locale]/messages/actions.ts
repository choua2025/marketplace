"use server";

import { getActor } from "@/server/auth/session";
import { startConversation } from "@/server/services/chat";
import { countUnreadMessages } from "@/server/services/chat-read";
import { toActionResult } from "@/server/actions/result";

export async function startConversationAction(providerId: string) {
  return toActionResult(async () => startConversation(await getActor(), { providerId }));
}

/** For the header's Messages badge; 0 when signed out. */
export async function unreadMessageCountAction(): Promise<number> {
  return countUnreadMessages(await getActor());
}
