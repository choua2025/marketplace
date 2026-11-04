import { beforeEach, describe, expect, it } from "vitest";
import { createReview, getReviewForBooking, updateReview } from "@/server/services/review";
import type { Actor } from "@/server/lib/actor";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

async function createCustomer(id: string): Promise<Actor> {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({ data: { id, role: "customer", fullName: id } });
  return { id, role: "customer" };
}

async function createProvider(id: string): Promise<Actor> {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({ data: { id, role: "provider", fullName: id } });
  await testOwnerDb.providerProfile.create({
    data: { id, displayName: id, isActive: true, latitude: "13.75", longitude: "100.50" },
  });
  return { id, role: "provider" };
}

let categoryId: number;

async function createBookingFixture(
  customerId: string,
  providerId: string,
  options: { status?: "pending" | "completed"; completedAt?: Date } = {},
) {
  const { status = "completed", completedAt = new Date() } = options;
  const booking = await testOwnerDb.booking.create({
    data: {
      customerId,
      providerId,
      categoryId,
      status,
      startAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endAt: new Date(Date.now() - 60 * 60 * 1000),
      description: "ทดสอบรีวิวสำหรับ integration test",
      address: "123 ถนนทดสอบ กรุงเทพฯ",
      completedAt: status === "completed" ? completedAt : null,
    },
    select: { id: true },
  });
  return booking.id;
}

beforeEach(async () => {
  await resetTestDatabase();
  const category = await testOwnerDb.category.create({
    data: { slug: "electrician", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", icon: "zap" },
    select: { id: true },
  });
  categoryId = category.id;
});

describe("createReview", () => {
  it("rejects reviewing a booking that isn't completed", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id, { status: "pending" });

    await expect(createReview(customer, { bookingId, rating: 5 })).rejects.toMatchObject({
      code: "BOOKING_NOT_COMPLETED",
    });
  });

  it("rejects someone reviewing a booking that isn't theirs (BOOKING_NOT_FOUND)", async () => {
    const customer = await createCustomer("cust1");
    const outsider = await createCustomer("cust2");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);

    await expect(createReview(outsider, { bookingId, rating: 5 })).rejects.toMatchObject({
      code: "BOOKING_NOT_FOUND",
    });
  });

  it("rejects a duplicate review for the same booking", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);

    await createReview(customer, { bookingId, rating: 5 });
    await expect(createReview(customer, { bookingId, rating: 3 })).rejects.toMatchObject({
      code: "REVIEW_EXISTS",
    });
  });

  it("rejects reviewing a booking completed more than 30 days ago", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const completedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const bookingId = await createBookingFixture(customer.id, provider.id, { completedAt });

    await expect(createReview(customer, { bookingId, rating: 5 })).rejects.toMatchObject({
      code: "REVIEW_WINDOW_EXPIRED",
    });
  });

  it("derives provider_id/customer_id from the booking, ignoring any client-supplied value", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);

    const review = await createReview(customer, {
      bookingId,
      rating: 4,
      providerId: "someone-else",
      customerId: "someone-else",
    });

    expect(review.providerId).toBe(provider.id);
    expect(review.customerId).toBe(customer.id);
  });

  it("updates the provider's rating_avg/rating_count via the DB trigger", async () => {
    const customerA = await createCustomer("cust1");
    const customerB = await createCustomer("cust2");
    const provider = await createProvider("prov1");
    const bookingA = await createBookingFixture(customerA.id, provider.id);
    const bookingB = await createBookingFixture(customerB.id, provider.id);

    await createReview(customerA, { bookingId: bookingA, rating: 5 });
    await createReview(customerB, { bookingId: bookingB, rating: 3 });

    const row = await testOwnerDb.providerProfile.findUnique({
      where: { id: provider.id },
      select: { ratingAvg: true, ratingCount: true },
    });

    expect(row?.ratingCount).toBe(2);
    expect(Number(row?.ratingAvg)).toBe(4);
  });
});

describe("updateReview", () => {
  it("lets the author edit within the 7-day window and re-triggers the rating update", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);
    const review = await createReview(customer, { bookingId, rating: 2 });

    await updateReview(customer, review.id, { rating: 5, comment: "แก้ไขแล้ว" });

    const row = await testOwnerDb.providerProfile.findUnique({
      where: { id: provider.id },
      select: { ratingAvg: true },
    });
    expect(Number(row?.ratingAvg)).toBe(5);
  });

  it("rejects editing someone else's review", async () => {
    const customer = await createCustomer("cust1");
    const outsider = await createCustomer("cust2");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);
    const review = await createReview(customer, { bookingId, rating: 4 });

    await expect(updateReview(outsider, review.id, { rating: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects editing after the 7-day window", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);
    const review = await createReview(customer, { bookingId, rating: 4 });

    await testOwnerDb.review.update({
      where: { id: review.id },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });

    await expect(updateReview(customer, review.id, { rating: 1 })).rejects.toMatchObject({
      code: "REVIEW_EDIT_WINDOW_EXPIRED",
    });
  });
});

describe("getReviewForBooking", () => {
  it("returns null when there's no review yet", async () => {
    const customer = await createCustomer("cust1");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);

    expect(await getReviewForBooking(customer, bookingId)).toBeNull();
  });

  it("hides the review from an outsider (NOT_FOUND)", async () => {
    const customer = await createCustomer("cust1");
    const outsider = await createCustomer("cust2");
    const provider = await createProvider("prov1");
    const bookingId = await createBookingFixture(customer.id, provider.id);
    await createReview(customer, { bookingId, rating: 4 });

    await expect(getReviewForBooking(outsider, bookingId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
