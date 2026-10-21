import { beforeEach, describe, expect, it } from "vitest";
import { markConversationRead, sendMessage, startConversation } from "@/server/services/chat";
import {
  getConversationDetail,
  listConversations,
  listMessages,
} from "@/server/services/chat-read";
import { subscribeToConversation } from "@/server/realtime/pg-listener";
import { resetRateLimitsForTesting } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { messages, profiles, providerProfiles, user } from "@/server/db/schema";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

async function createCustomerFixture(id: string): Promise<Actor> {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "customer", fullName: id });
  return { id, role: "customer" };
}

async function createProviderFixture(id: string): Promise<Actor> {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "provider", fullName: id });
  await testOwnerDb
    .insert(providerProfiles)
    .values({ id, displayName: id, isActive: true, latitude: "13.75", longitude: "100.50" });
  return { id, role: "provider" };
}

beforeEach(async () => {
  await resetTestDatabase();
  resetRateLimitsForTesting();
});

describe("startConversation", () => {
  it("is idempotent -- calling it twice returns the same conversation", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");

    const first = await startConversation(customer, { providerId: provider.id });
    const second = await startConversation(customer, { providerId: provider.id });

    expect(first.id).toBe(second.id);
  });

  it("rejects an anonymous actor", async () => {
    const provider = await createProviderFixture("prov1");
    await expect(startConversation(null, { providerId: provider.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a provider trying to start a conversation", async () => {
    const provider = await createProviderFixture("prov1");
    const otherProvider = await createProviderFixture("prov2");
    await expect(
      startConversation(otherProvider, { providerId: provider.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects chatting with yourself", async () => {
    const customer = await createCustomerFixture("cust1");
    await expect(startConversation(customer, { providerId: customer.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("sendMessage", () => {
  it("always stamps sender_id from the session, never from input", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    const message = await sendMessage(customer, conversation.id, {
      body: "hello",
      senderId: provider.id,
    });

    expect(message.senderId).toBe(customer.id);
  });

  it("rejects an outsider sending a message (NOT_FOUND, not FORBIDDEN)", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const outsider = await createCustomerFixture("cust2");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await expect(sendMessage(outsider, conversation.id, { body: "hack" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("requires a body or an image", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await expect(sendMessage(customer, conversation.id, {})).rejects.toThrow();
  });

  it("rejects an image key that doesn't belong to this conversation", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await expect(
      sendMessage(customer, conversation.id, { imageKey: "chat/some-other-conversation/x.png" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rate limits at the 21st message within a minute", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    for (let i = 0; i < 20; i++) {
      await sendMessage(customer, conversation.id, { body: `msg ${i}` });
    }

    await expect(sendMessage(customer, conversation.id, { body: "msg 21" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("triggers a NOTIFY on the chat_<conversationId> channel with the new message id", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    let notifiedId: string | null = null;
    const unsubscribe = await subscribeToConversation(conversation.id, (messageId) => {
      notifiedId = messageId;
    });

    const message = await sendMessage(customer, conversation.id, { body: "hi" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    unsubscribe();

    expect(notifiedId).toBe(String(message.id));
  });
});

describe("listMessages / listConversations / markConversationRead", () => {
  it("rejects an outsider reading messages (NOT_FOUND, not FORBIDDEN)", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const outsider = await createCustomerFixture("cust2");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await expect(listMessages(outsider, conversation.id, {})).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("paginates with a cursor, newest page first, oldest-to-newest within a page", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    // Inserted directly (bypassing sendMessage/the rate limiter) since this
    // test is about pagination over volume, not send-time rules.
    await testOwnerDb.insert(messages).values(
      Array.from({ length: 35 }, (_, i) => ({
        conversationId: conversation.id,
        senderId: customer.id,
        body: `msg ${i}`,
      })),
    );

    const firstPage = await listMessages(customer, conversation.id, {});
    expect(firstPage.items).toHaveLength(30);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(firstPage.items[0]?.body).toBe("msg 5");
    expect(firstPage.items.at(-1)?.body).toBe("msg 34");

    const secondPage = await listMessages(customer, conversation.id, {
      cursor: firstPage.nextCursor!,
    });
    expect(secondPage.items).toHaveLength(5);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.items[0]?.body).toBe("msg 0");
  });

  it("markConversationRead only marks the other party's unread messages", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await sendMessage(customer, conversation.id, { body: "from customer" });
    await sendMessage(provider, conversation.id, { body: "from provider" });

    await markConversationRead(customer, conversation.id);
    const { items } = await listMessages(customer, conversation.id, {});

    const fromCustomer = items.find((m) => m.senderId === customer.id);
    const fromProvider = items.find((m) => m.senderId === provider.id);
    expect(fromCustomer?.readAt).toBeNull();
    expect(fromProvider?.readAt).not.toBeNull();
  });

  it("listConversations reports unread count and clears it after marking read", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });
    await sendMessage(provider, conversation.id, { body: "hi" });

    const before = await listConversations(customer);
    expect(before[0]?.unreadCount).toBe(1);

    await markConversationRead(customer, conversation.id);
    const after = await listConversations(customer);
    expect(after[0]?.unreadCount).toBe(0);
  });

  it("getConversationDetail resolves the counterparty for each side", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    const asCustomer = await getConversationDetail(customer, conversation.id);
    const asProvider = await getConversationDetail(provider, conversation.id);
    expect(asCustomer.counterpartyId).toBe(provider.id);
    expect(asProvider.counterpartyId).toBe(customer.id);
  });
});
