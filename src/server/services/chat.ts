import { db } from "@/server/db/client";
import type { Prisma } from "@/server/db/generated/prisma/client";
import { AppError } from "@/server/lib/errors";
import { checkRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { sendMessageSchema, startConversationSchema } from "@/lib/validations/chat";

const MESSAGES_PER_MINUTE = 20;

export const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  imageKey: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

export interface MessageDto {
  id: number;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** messages.id is a Postgres bigint -- Prisma surfaces it as a native
 * `bigint`, which JSON.stringify (used by the SSE route) can't serialize.
 * Converted to `number` at the service boundary, same as the previous
 * Drizzle `mode: "number"` column did. */
export function toMessageDto(
  row: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
): MessageDto {
  return { ...row, id: Number(row.id) };
}

/**
 * Fetches one message by id, for the SSE route to re-hydrate a NOTIFY
 * payload. No actor check here -- the route already verified the actor is
 * a party of the conversation before it ever subscribed to its channel.
 */
export async function getMessageById(messageId: number): Promise<MessageDto | undefined> {
  const message = await db.message.findUnique({ where: { id: messageId }, select: messageSelect });
  return message ? toMessageDto(message) : undefined;
}

/** Loads a conversation and asserts `actor` is one of its two parties. */
export async function assertConversationParty(actor: Actor, conversationId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, providerId: true },
  });

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

  return db.conversation.upsert({
    where: { customerId_providerId: { customerId: actor.id, providerId } },
    create: { customerId: actor.id, providerId },
    update: {},
  });
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

  const created = await db.message.create({
    data: {
      conversationId,
      senderId: actor.id,
      body: parsed.body ?? null,
      imageKey: parsed.imageKey ?? null,
    },
    select: messageSelect,
  });

  return toMessageDto(created);
}

/** Marks every message the *other* party sent as read. */
export async function markConversationRead(
  actor: Actor | null,
  conversationId: string,
): Promise<void> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await assertConversationParty(actor, conversationId);

  await db.message.updateMany({
    where: { conversationId, senderId: { not: actor.id }, readAt: null },
    data: { readAt: new Date() },
  });
}
