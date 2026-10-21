import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversations, messages } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { checkRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { sendMessageSchema, startConversationSchema } from "@/lib/validations/chat";

const MESSAGES_PER_MINUTE = 20;

export const messageColumns = {
  id: messages.id,
  conversationId: messages.conversationId,
  senderId: messages.senderId,
  body: messages.body,
  imageKey: messages.imageKey,
  readAt: messages.readAt,
  createdAt: messages.createdAt,
};

export type MessageDto = Awaited<ReturnType<typeof sendMessage>>;

/**
 * Fetches one message by id, for the SSE route to re-hydrate a NOTIFY
 * payload. No actor check here -- the route already verified the actor is
 * a party of the conversation before it ever subscribed to its channel.
 */
export async function getMessageById(messageId: number): Promise<MessageDto | undefined> {
  const [message] = await db
    .select(messageColumns)
    .from(messages)
    .where(eq(messages.id, messageId));
  return message;
}

/** Loads a conversation and asserts `actor` is one of its two parties. */
export async function assertConversationParty(actor: Actor, conversationId: string) {
  const [conversation] = await db
    .select({
      id: conversations.id,
      customerId: conversations.customerId,
      providerId: conversations.providerId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId));

  // Outsiders get NOT_FOUND, never FORBIDDEN, so they can't tell the
  // conversation exists at all (same reasoning as bookings, SPEC.md 7.3).
  if (!conversation) throw new AppError("NOT_FOUND");
  const isParty = conversation.customerId === actor.id || conversation.providerId === actor.id;
  if (!isParty) throw new AppError("NOT_FOUND");

  return conversation;
}

/**
 * Starts (or returns the existing) conversation between the calling
 * customer and a provider (SPEC.md section 7.8). Idempotent via the
 * `conversations_customer_provider_unique` constraint.
 */
export async function startConversation(actor: Actor | null, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "customer") throw new AppError("FORBIDDEN");

  const { providerId } = startConversationSchema.parse(input);
  if (providerId === actor.id) throw new AppError("FORBIDDEN");

  await db
    .insert(conversations)
    .values({ customerId: actor.id, providerId })
    .onConflictDoNothing({ target: [conversations.customerId, conversations.providerId] });

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.customerId, actor.id), eq(conversations.providerId, providerId)));

  if (!conversation) throw new Error("failed to create or load conversation");
  return conversation;
}

function assertImageKeyBelongsToConversation(imageKey: string, conversationId: string): void {
  if (!imageKey.startsWith(`chat/${conversationId}/`)) {
    throw new AppError("FORBIDDEN");
  }
}

/**
 * Sends a message (SPEC.md section 7.8). `sender_id` always comes from the
 * session, never from `input` -- there is no field for it in the schema.
 */
export async function sendMessage(actor: Actor | null, conversationId: string, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await assertConversationParty(actor, conversationId);

  const { allowed } = checkRateLimit(`chat-send:${actor.id}`, MESSAGES_PER_MINUTE, 60 * 1000);
  if (!allowed) throw new AppError("RATE_LIMITED");

  const parsed = sendMessageSchema.parse(input);
  if (parsed.imageKey) assertImageKeyBelongsToConversation(parsed.imageKey, conversationId);

  const [created] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId: actor.id,
      body: parsed.body ?? null,
      imageKey: parsed.imageKey ?? null,
    })
    .returning(messageColumns);

  if (!created) throw new Error("failed to insert message");
  return created;
}

/** Marks every message the *other* party sent as read. */
export async function markConversationRead(
  actor: Actor | null,
  conversationId: string,
): Promise<void> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await assertConversationParty(actor, conversationId);

  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, actor.id),
        isNull(messages.readAt),
      ),
    );
}
