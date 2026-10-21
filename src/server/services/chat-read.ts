import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversations, messages, profiles, providerProfiles } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { assertConversationParty, messageColumns, type MessageDto } from "@/server/services/chat";
import type { Actor } from "@/server/lib/actor";
import { listMessagesSchema, MESSAGES_PAGE_SIZE } from "@/lib/validations/chat";

/** Cursor-paginated message history (`id < cursor`, newest page first). */
export async function listMessages(
  actor: Actor | null,
  conversationId: string,
  input: unknown,
): Promise<{ items: MessageDto[]; nextCursor: number | null }> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await assertConversationParty(actor, conversationId);

  const { cursor } = listMessagesSchema.parse(input);

  const rows = await db
    .select(messageColumns)
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        cursor !== undefined ? lt(messages.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(messages.id))
    .limit(MESSAGES_PAGE_SIZE);

  // `rows` is newest-first; the oldest id in this page is the cursor for
  // the next (older) page. Compute it before reversing -- reverse() mutates
  // in place, so reading from `rows` afterwards would read the wrong end.
  const nextCursor = rows.length === MESSAGES_PAGE_SIZE ? rows.at(-1)!.id : null;
  const items = rows.reverse();
  return { items, nextCursor };
}

export interface ConversationListItemDto {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

/** Inbox list: every conversation `actor` is a party to, newest activity first. */
export async function listConversations(actor: Actor | null): Promise<ConversationListItemDto[]> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const unreadCount = sql<number>`(
    select count(*) from ${messages}
    where ${messages.conversationId} = ${conversations.id}
      and ${messages.senderId} <> ${actor.id}
      and ${messages.readAt} is null
  )`.as("unread_count");

  const lastMessagePreview = sql<string | null>`(
    select coalesce(${messages.body}, 'รูปภาพ') from ${messages}
    where ${messages.conversationId} = ${conversations.id}
    order by ${messages.id} desc
    limit 1
  )`.as("last_message_preview");

  const rows = await db
    .select({
      id: conversations.id,
      customerId: conversations.customerId,
      providerId: conversations.providerId,
      customerName: profiles.fullName,
      providerName: providerProfiles.displayName,
      lastMessageAt: conversations.lastMessageAt,
      lastMessagePreview,
      unreadCount,
    })
    .from(conversations)
    .innerJoin(profiles, eq(profiles.id, conversations.customerId))
    .innerJoin(providerProfiles, eq(providerProfiles.id, conversations.providerId))
    .where(or(eq(conversations.customerId, actor.id), eq(conversations.providerId, actor.id)))
    .orderBy(desc(conversations.lastMessageAt));

  return rows.map((row) => ({
    id: row.id,
    counterpartyId: actor.id === row.customerId ? row.providerId : row.customerId,
    counterpartyName: actor.id === row.customerId ? row.providerName : row.customerName,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    unreadCount: Number(row.unreadCount),
  }));
}

/** Conversation header info for the thread page: who the other party is. */
export async function getConversationDetail(actor: Actor | null, conversationId: string) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await assertConversationParty(actor, conversationId);

  const [row] = await db
    .select({
      customerId: conversations.customerId,
      providerId: conversations.providerId,
      customerName: profiles.fullName,
      providerName: providerProfiles.displayName,
    })
    .from(conversations)
    .innerJoin(profiles, eq(profiles.id, conversations.customerId))
    .innerJoin(providerProfiles, eq(providerProfiles.id, conversations.providerId))
    .where(eq(conversations.id, conversationId));

  if (!row) throw new AppError("NOT_FOUND");

  return {
    counterpartyId: actor.id === row.customerId ? row.providerId : row.customerId,
    counterpartyName: actor.id === row.customerId ? row.providerName : row.customerName,
  };
}
