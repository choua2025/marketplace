import { db } from "@/server/db/client";
import { Prisma } from "@/server/db/generated/prisma/client";
import { AppError } from "@/server/lib/errors";
import {
  assertConversationParty,
  messageSelect,
  toMessageDto,
  type MessageDto,
} from "@/server/services/chat";
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

  const rows = await db.message.findMany({
    where: {
      conversationId,
      ...(cursor !== undefined ? { id: { lt: cursor } } : {}),
    },
    select: messageSelect,
    orderBy: { id: "desc" },
    take: MESSAGES_PAGE_SIZE,
  });

  // `rows` is newest-first; the oldest id in this page is the cursor for
  // the next (older) page. Compute it before reversing -- reverse() mutates
  // in place, so reading from `rows` afterwards would read the wrong end.
  const nextCursor = rows.length === MESSAGES_PAGE_SIZE ? Number(rows.at(-1)!.id) : null;
  const items = rows.reverse().map(toMessageDto);
  return { items, nextCursor };
}

export interface ConversationListItemDto {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  /** Last message is a photo with no text -- the UI shows a localized label. */
  lastMessageIsImage: boolean;
  unreadCount: number;
}

interface ConversationListRow {
  id: string;
  customerId: string;
  providerId: string;
  customerName: string;
  providerName: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageIsImage: boolean;
  unreadCount: bigint;
}

/**
 * Inbox list: every conversation `actor` is a party to, newest activity
 * first. Raw SQL -- "unread count" and "latest message preview" are
 * per-row correlated subqueries, which Prisma's query builder can't
 * express (no query-builder equivalent of a lateral/correlated subquery
 * in a select list).
 */
export async function listConversations(actor: Actor | null): Promise<ConversationListItemDto[]> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const rows = await db.$queryRaw<ConversationListRow[]>(Prisma.sql`
    SELECT
      c."id",
      c."customer_id" AS "customerId",
      c."provider_id" AS "providerId",
      p."full_name" AS "customerName",
      pp."display_name" AS "providerName",
      c."last_message_at" AS "lastMessageAt",
      last."body" AS "lastMessagePreview",
      (last."id" IS NOT NULL AND last."body" IS NULL) AS "lastMessageIsImage",
      (
        SELECT COUNT(*) FROM "messages" m
        WHERE m."conversation_id" = c."id"
          AND m."sender_id" <> ${actor.id}
          AND m."read_at" IS NULL
      ) AS "unreadCount"
    FROM "conversations" c
    INNER JOIN "profiles" p ON p."id" = c."customer_id"
    INNER JOIN "provider_profiles" pp ON pp."id" = c."provider_id"
    LEFT JOIN LATERAL (
      SELECT m."id", m."body" FROM "messages" m
      WHERE m."conversation_id" = c."id"
      ORDER BY m."id" DESC
      LIMIT 1
    ) last ON true
    WHERE c."customer_id" = ${actor.id} OR c."provider_id" = ${actor.id}
    ORDER BY c."last_message_at" DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    counterpartyId: actor.id === row.customerId ? row.providerId : row.customerId,
    counterpartyName: actor.id === row.customerId ? row.providerName : row.customerName,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    lastMessageIsImage: row.lastMessageIsImage,
    unreadCount: Number(row.unreadCount),
  }));
}

/** Conversation header info for the thread page: who the other party is. */
export async function getConversationDetail(actor: Actor | null, conversationId: string) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await assertConversationParty(actor, conversationId);

  const row = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      customerId: true,
      providerId: true,
      customer: { select: { fullName: true } },
      provider: { select: { displayName: true } },
    },
  });

  if (!row) throw new AppError("NOT_FOUND");

  return {
    counterpartyId: actor.id === row.customerId ? row.providerId : row.customerId,
    counterpartyName:
      actor.id === row.customerId ? row.provider.displayName : row.customer.fullName,
  };
}
