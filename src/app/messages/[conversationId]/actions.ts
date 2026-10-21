"use server";

import { getActor } from "@/server/auth/session";
import { markConversationRead, sendMessage } from "@/server/services/chat";
import { listMessages } from "@/server/services/chat-read";
import { getSignedImageUrl } from "@/server/services/upload";
import { toActionResult } from "@/server/actions/result";

export async function sendMessageAction(conversationId: string, input: unknown) {
  return toActionResult(async () => sendMessage(await getActor(), conversationId, input));
}

export async function markConversationReadAction(conversationId: string) {
  return toActionResult(async () => markConversationRead(await getActor(), conversationId));
}

export async function loadOlderMessagesAction(conversationId: string, cursor: number) {
  return toActionResult(async () => {
    const { items, nextCursor } = await listMessages(await getActor(), conversationId, { cursor });
    const withUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        imageUrl: await getSignedImageUrl(item.imageKey),
      })),
    );
    return { items: withUrls, nextCursor };
  });
}
