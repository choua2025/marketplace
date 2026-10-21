import { beforeEach, describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { resetTestDatabase, testDb } from "../helpers/db";
import {
  bookings,
  categories,
  conversations,
  messages,
  profiles,
  providerProfiles,
  reviews,
  user,
} from "@/server/db/schema";

function pgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof DrizzleQueryError)) return undefined;
  const cause = error.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return undefined;
  return String((cause as { code: unknown }).code);
}

async function createUserChain(id: string, role: "customer" | "provider") {
  await testDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testDb.insert(profiles).values({ id, role, fullName: id });
  if (role === "provider") {
    await testDb
      .insert(providerProfiles)
      .values({ id, displayName: id, isActive: true, latitude: "13.75", longitude: "100.50" });
  }
}

async function createCategory(slug: string): Promise<number> {
  const [row] = await testDb
    .insert(categories)
    .values({ slug, nameTh: slug, nameEn: slug, icon: "zap" })
    .returning({ id: categories.id });
  if (!row) throw new Error("failed to insert category");
  return row.id;
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("no_double_booking exclusion constraint", () => {
  it("rejects an overlapping confirmed booking for the same provider with 23P01", async () => {
    await createUserChain("cust1", "customer");
    await createUserChain("prov1", "provider");
    const categoryId = await createCategory("electrician");

    await testDb.insert(bookings).values({
      customerId: "cust1",
      providerId: "prov1",
      categoryId,
      status: "confirmed",
      startAt: new Date("2026-11-01T10:00:00+07:00"),
      endAt: new Date("2026-11-01T12:00:00+07:00"),
      description: "First confirmed booking for overlap test",
      address: "123 Test Rd, Bangkok",
    });

    let caught: unknown;
    try {
      await testDb.insert(bookings).values({
        customerId: "cust1",
        providerId: "prov1",
        categoryId,
        status: "confirmed",
        startAt: new Date("2026-11-01T11:00:00+07:00"),
        endAt: new Date("2026-11-01T13:00:00+07:00"),
        description: "Overlapping confirmed booking for the same provider",
        address: "123 Test Rd, Bangkok",
      });
    } catch (error) {
      caught = error;
    }

    expect(pgErrorCode(caught)).toBe("23P01");
  });

  it("allows two overlapping pending bookings for the same provider", async () => {
    await createUserChain("cust1", "customer");
    await createUserChain("prov1", "provider");
    const categoryId = await createCategory("electrician");

    await testDb.insert(bookings).values({
      customerId: "cust1",
      providerId: "prov1",
      categoryId,
      status: "pending",
      startAt: new Date("2026-11-01T10:00:00+07:00"),
      endAt: new Date("2026-11-01T12:00:00+07:00"),
      description: "First pending booking for overlap test",
      address: "123 Test Rd, Bangkok",
    });

    await expect(
      testDb.insert(bookings).values({
        customerId: "cust1",
        providerId: "prov1",
        categoryId,
        status: "pending",
        startAt: new Date("2026-11-01T11:00:00+07:00"),
        endAt: new Date("2026-11-01T13:00:00+07:00"),
        description: "Second overlapping pending booking, should be allowed",
        address: "123 Test Rd, Bangkok",
      }),
    ).resolves.toBeDefined();

    const rows = await testDb.select().from(bookings).where(eq(bookings.providerId, "prov1"));
    expect(rows).toHaveLength(2);
  });

  it("allows a non-overlapping confirmed booking for the same provider", async () => {
    await createUserChain("cust1", "customer");
    await createUserChain("prov1", "provider");
    const categoryId = await createCategory("electrician");

    await testDb.insert(bookings).values({
      customerId: "cust1",
      providerId: "prov1",
      categoryId,
      status: "confirmed",
      startAt: new Date("2026-11-01T10:00:00+07:00"),
      endAt: new Date("2026-11-01T12:00:00+07:00"),
      description: "First confirmed booking, non-overlap test",
      address: "123 Test Rd, Bangkok",
    });

    await expect(
      testDb.insert(bookings).values({
        customerId: "cust1",
        providerId: "prov1",
        categoryId,
        status: "confirmed",
        startAt: new Date("2026-11-01T12:00:00+07:00"),
        endAt: new Date("2026-11-01T14:00:00+07:00"),
        description: "Second confirmed booking right after, should be allowed",
        address: "123 Test Rd, Bangkok",
      }),
    ).resolves.toBeDefined();
  });
});

describe("provider rating trigger", () => {
  async function createCompletedBooking(id: string, categoryId: number) {
    const [row] = await testDb
      .insert(bookings)
      .values({
        id,
        customerId: "cust1",
        providerId: "prov1",
        categoryId,
        status: "completed",
        startAt: new Date("2026-11-01T10:00:00+07:00"),
        endAt: new Date("2026-11-01T12:00:00+07:00"),
        description: "Completed booking used as the review's basis",
        address: "123 Test Rd, Bangkok",
      })
      .returning({ id: bookings.id });
    if (!row) throw new Error("failed to insert booking");
    return row.id;
  }

  it("updates rating_avg/rating_count on insert, update, and delete", async () => {
    await createUserChain("cust1", "customer");
    await createUserChain("prov1", "provider");
    const categoryId = await createCategory("electrician");

    const bookingId1 = await createCompletedBooking(
      "11111111-1111-1111-1111-111111111111",
      categoryId,
    );
    const bookingId2 = await createCompletedBooking(
      "22222222-2222-2222-2222-222222222222",
      categoryId,
    );

    await testDb
      .insert(reviews)
      .values({ bookingId: bookingId1, customerId: "cust1", providerId: "prov1", rating: 5 });

    let [providerRow] = await testDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, "prov1"));
    expect(providerRow?.ratingAvg).toBe("5.00");
    expect(providerRow?.ratingCount).toBe(1);

    const [review2] = await testDb
      .insert(reviews)
      .values({ bookingId: bookingId2, customerId: "cust1", providerId: "prov1", rating: 3 })
      .returning({ id: reviews.id });
    if (!review2) throw new Error("failed to insert second review");

    [providerRow] = await testDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, "prov1"));
    expect(providerRow?.ratingAvg).toBe("4.00");
    expect(providerRow?.ratingCount).toBe(2);

    await testDb.update(reviews).set({ rating: 1 }).where(eq(reviews.id, review2.id));

    [providerRow] = await testDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, "prov1"));
    expect(providerRow?.ratingAvg).toBe("3.00");
    expect(providerRow?.ratingCount).toBe(2);

    await testDb.delete(reviews).where(eq(reviews.id, review2.id));

    [providerRow] = await testDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, "prov1"));
    expect(providerRow?.ratingAvg).toBe("5.00");
    expect(providerRow?.ratingCount).toBe(1);
  });
});

describe("chat notify trigger", () => {
  it("updates conversations.last_message_at when a message is inserted", async () => {
    await createUserChain("cust1", "customer");
    await createUserChain("prov1", "provider");

    const [conversation] = await testDb
      .insert(conversations)
      .values({ customerId: "cust1", providerId: "prov1" })
      .returning({ id: conversations.id });
    if (!conversation) throw new Error("failed to insert conversation");
    expect(conversation.id).toBeDefined();

    const before = await testDb
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversation.id));
    expect(before[0]?.lastMessageAt).toBeNull();

    await testDb
      .insert(messages)
      .values({ conversationId: conversation.id, senderId: "cust1", body: "Hello!" });

    const after = await testDb
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversation.id));
    expect(after[0]?.lastMessageAt).not.toBeNull();
  });
});

describe("updated_at trigger", () => {
  it("bumps updated_at on update", async () => {
    await createUserChain("prov1", "provider");

    const [before] = await testDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, "prov1"));
    if (!before) throw new Error("provider profile not found");

    await new Promise((resolve) => setTimeout(resolve, 10));

    await testDb
      .update(providerProfiles)
      .set({ bio: "Updated bio for the trigger test" })
      .where(eq(providerProfiles.id, "prov1"));

    const [after] = await testDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, "prov1"));
    if (!after) throw new Error("provider profile not found after update");

    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
});
