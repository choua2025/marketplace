import { beforeEach, describe, expect, it } from "vitest";
import { markConversationRead, sendMessage, startConversation } from "@/server/services/chat";
import {
  countUnreadMessages,
  getConversationDetail,
  listConversations,
  listMessages,
} from "@/server/services/chat-read";
import { subscribeToConversation } from "@/server/realtime/pg-listener";
import { resetRateLimitsForTesting } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { setEmailProviderForTesting } from "@/server/email";
import { setMessageEmailDelayForTesting } from "@/server/services/notifications";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";
import { RecordingEmailProvider } from "../helpers/recording-email-provider";

async function createCustomerFixture(id: string): Promise<Actor> {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({ data: { id, role: "customer", fullName: id } });
  return { id, role: "customer" };
}

async function createProviderFixture(id: string): Promise<Actor> {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({ data: { id, role: "provider", fullName: id } });
  await testOwnerDb.providerProfile.create({
    data: { id, displayName: id, isActive: true, latitude: "13.75", longitude: "100.50" },
  });
  return { id, role: "provider" };
}

let mail: RecordingEmailProvider;

beforeEach(async () => {
  await resetTestDatabase();
  await resetRateLimitsForTesting();
  mail = new RecordingEmailProvider();
  setEmailProviderForTesting(mail);
  setMessageEmailDelayForTesting(0);
});

/** Emails are sent in the background -- give them a moment to land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
const emailsTo = (to: string) => mail.sent.filter((m) => m.to === to);

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

describe("new-message emails", () => {
  it("emails the other party once per unread streak, with the message quoted", async () => {
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await sendMessage(customer, conversation.id, { body: "แอร์ไม่เย็นครับ" });
    await settle();
    const first = emailsTo("prov1@test.local");
    expect(first).toHaveLength(1);
    expect(first[0]!.text).toContain("แอร์ไม่เย็นครับ");
    expect(first[0]!.subject).toContain("cust1");
    expect(new URL(first[0]!.text.match(/https?:\/\/\S+/)![0]).pathname).toBe(
      `/messages/${conversation.id}`,
    );

    // Still unread: no second email.
    await sendMessage(customer, conversation.id, { body: "ช่วยตอบด้วยครับ" });
    await settle();
    expect(emailsTo("prov1@test.local")).toHaveLength(1);

    // Once read, the next message emails again.
    await markConversationRead(provider, conversation.id);
    await sendMessage(customer, conversation.id, { body: "พรุ่งนี้ว่างไหม" });
    await settle();
    expect(emailsTo("prov1@test.local")).toHaveLength(2);

    // The sender never gets an email about their own messages.
    expect(emailsTo("cust1@test.local")).toHaveLength(0);
  });

  it("skips the email when the message is read during the delay", async () => {
    setMessageEmailDelayForTesting(150);
    const customer = await createCustomerFixture("cust1");
    const provider = await createProviderFixture("prov1");
    const conversation = await startConversation(customer, { providerId: provider.id });

    await sendMessage(provider, conversation.id, { body: "สวัสดีครับ" });
    await markConversationRead(customer, conversation.id);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(emailsTo("cust1@test.local")).toHaveLength(0);
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
    await testOwnerDb.message.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        conversationId: conversation.id,
        senderId: customer.id,
        body: `msg ${i}`,
      })),
    });

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

  it("countUnreadMessages totals unread messages from others across conversations", async () => {
    const customer = await createCustomerFixture("cust1");
    const providerA = await createProviderFixture("prov1");
    const providerB = await createProviderFixture("prov2");
    const outsider = await createCustomerFixture("cust2");
    const convA = await startConversation(customer, { providerId: providerA.id });
    const convB = await startConversation(customer, { providerId: providerB.id });
    const otherConv = await startConversation(outsider, { providerId: providerA.id });

    await sendMessage(providerA, convA.id, { body: "a1" });
    await sendMessage(providerA, convA.id, { body: "a2" });
    await sendMessage(providerB, convB.id, { body: "b1" });
    await sendMessage(customer, convA.id, { body: "own message, never unread" });
    await sendMessage(providerA, otherConv.id, { body: "someone else's chat" });

    expect(await countUnreadMessages(customer)).toBe(3);
    expect(await countUnreadMessages(providerA)).toBe(1);
    expect(await countUnreadMessages(null)).toBe(0);

    await markConversationRead(customer, convA.id);
    expect(await countUnreadMessages(customer)).toBe(1);
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
