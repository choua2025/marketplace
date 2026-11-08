import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, updateBookingStatus } from "@/server/services/booking";
import { countPendingRequests, getBookingContact } from "@/server/services/booking-read";
import type { Actor } from "@/server/lib/actor";
import { timeStringToDate } from "@/server/lib/pg-time";
import { setEmailProviderForTesting } from "@/server/email";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";
import { RecordingEmailProvider } from "../helpers/recording-email-provider";

const WEEKDAYS_MON_SAT = [1, 2, 3, 4, 5, 6];

async function createProviderWithAvailability(id: string, categorySlug = "electrician") {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({ data: { id, role: "provider", fullName: id } });
  await testOwnerDb.profileContact.create({ data: { id, phone: "+66820000000" } });
  await testOwnerDb.providerProfile.create({
    data: { id, displayName: id, isActive: true, latitude: "13.75", longitude: "100.50" },
  });

  const category = await testOwnerDb.category.findUnique({ where: { slug: categorySlug } });
  if (category) {
    await testOwnerDb.providerCategory.create({
      data: { providerId: id, categoryId: category.id },
    });
  }

  await testOwnerDb.availabilityRule.createMany({
    data: WEEKDAYS_MON_SAT.map((weekday) => ({
      providerId: id,
      weekday,
      startTime: timeStringToDate("08:00:00"),
      endTime: timeStringToDate("18:00:00"),
    })),
  });

  return { id, role: "provider" as const } satisfies Actor;
}

async function createCustomerFixture(id: string): Promise<Actor> {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({ data: { id, role: "customer", fullName: id } });
  await testOwnerDb.profileContact.create({ data: { id, phone: "+66800000000" } });
  return { id, role: "customer" };
}

/** A Mon-Sat slot at least `minDaysAhead` days out, so it always fits the fixture's availability. */
function bookableSlot(minDaysAhead: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + minDaysAhead);
  date.setHours(hour, 0, 0, 0);
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

/** The next Sunday at least `minDaysAhead` days out -- for OUTSIDE_WORKING_HOURS (day off). */
function sundaySlot(minDaysAhead: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + minDaysAhead);
  date.setHours(hour, 0, 0, 0);
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function validBookingInput(providerId: string, overrides: Record<string, unknown> = {}) {
  const startAt = bookableSlot(2, 10);
  const endAt = bookableSlot(2, 12);
  return {
    providerId,
    categorySlug: "electrician",
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    description: "ทดสอบสร้างการจองสำหรับ integration test",
    address: "123 ถนนทดสอบ กรุงเทพฯ",
    ...overrides,
  };
}

let mail: RecordingEmailProvider;

beforeEach(async () => {
  await resetTestDatabase();
  mail = new RecordingEmailProvider();
  setEmailProviderForTesting(mail);
  await testOwnerDb.category.createMany({
    data: [
      { slug: "electrician", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", icon: "zap" },
      { slug: "plumber", nameTh: "ช่างประปา", nameEn: "Plumber", icon: "wrench" },
    ],
  });
});

describe("createBooking", () => {
  it("creates a pending booking and ignores a client-supplied status", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");

    const booking = await createBooking(customer, {
      ...validBookingInput(provider.id),
      status: "confirmed",
    });

    expect(booking.status).toBe("pending");
  });

  it("emails the provider a link to the new request", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");

    const booking = await createBooking(customer, validBookingInput(provider.id));

    const link = await mail.lastLinkTo("prov1@test.local");
    expect(link.pathname).toBe(`/bookings/${booking.id}`);
    const email = mail.sent.find((m) => m.to === "prov1@test.local")!;
    expect(email.subject).toContain("cust1");
    expect(email.text).toContain("ช่างไฟฟ้า");
    expect(mail.sent.some((m) => m.to === "cust1@test.local")).toBe(false);
  });

  it("rejects an anonymous actor", async () => {
    const provider = await createProviderWithAvailability("prov1");
    await expect(createBooking(null, validBookingInput(provider.id))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a provider actor trying to book", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const otherProvider = await createProviderWithAvailability("prov2");
    await expect(
      createBooking(otherProvider, validBookingInput(provider.id)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an inactive provider with PROVIDER_UNAVAILABLE", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    await testOwnerDb.providerProfile.update({
      where: { id: provider.id },
      data: { isActive: false },
    });

    await expect(createBooking(customer, validBookingInput(provider.id))).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("rejects a category the provider doesn't offer", async () => {
    const provider = await createProviderWithAvailability("prov1", "electrician");
    const customer = await createCustomerFixture("cust1");

    await expect(
      createBooking(customer, validBookingInput(provider.id, { categorySlug: "plumber" })),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_OFFERED" });
  });

  it("rejects a start time less than 1 hour away", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const soon = new Date(Date.now() + 10 * 60 * 1000);

    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: soon.toISOString(),
          endAt: new Date(soon.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_START_TIME" });
  });

  it("rejects a booking longer than 12 hours with a specific error", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const startAt = bookableSlot(2, 10);

    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_TIME_RANGE" });
  });

  it("rejects an end time before the start time with a specific error", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const startAt = bookableSlot(2, 10);

    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() - 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_TIME_RANGE" });
  });

  it("rejects a start time more than 90 days away", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const farAway = bookableSlot(95, 10);

    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: farAway.toISOString(),
          endAt: new Date(farAway.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_START_TIME" });
  });

  it("rejects a booking on the provider's day off", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const sunday = sundaySlot(2, 10);

    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: sunday.toISOString(),
          endAt: new Date(sunday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "OUTSIDE_WORKING_HOURS" });
  });

  it("rejects a booking past closing time", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const pastClosing = bookableSlot(2, 20); // 20:00, after 18:00 close

    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: pastClosing.toISOString(),
          endAt: new Date(pastClosing.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "OUTSIDE_WORKING_HOURS" });
  });

  it("allows overlapping pending requests for the same provider", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const startAt = bookableSlot(2, 10);

    await createBooking(
      customer,
      validBookingInput(provider.id, {
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      }),
    );
    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
          endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("rejects the 6th simultaneous pending booking from the same customer", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");

    for (let i = 0; i < 5; i++) {
      const startAt = bookableSlot(2 + i, 10);
      await createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      );
    }

    const startAt = bookableSlot(30, 10);
    await expect(
      createBooking(
        customer,
        validBookingInput(provider.id, {
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ code: "TOO_MANY_PENDING_BOOKINGS" });
  });
});

describe("getBookingContact", () => {
  it("locks contact info until confirmed, then reveals it", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await expect(getBookingContact(customer, booking.id)).rejects.toMatchObject({
      code: "CONTACT_LOCKED",
    });

    await updateBookingStatus(provider, booking.id, { status: "confirmed" });

    const contact = await getBookingContact(customer, booking.id);
    expect(contact.phone).toBe("+66820000000");
  });
});

describe("countPendingRequests", () => {
  it("counts only the provider's requests still waiting for an answer", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const first = await createBooking(customer, validBookingInput(provider.id));
    await createBooking(
      customer,
      validBookingInput(provider.id, {
        startAt: bookableSlot(3, 9).toISOString(),
        endAt: bookableSlot(3, 10).toISOString(),
      }),
    );
    expect(await countPendingRequests(provider)).toBe(2);

    await updateBookingStatus(provider, first.id, { status: "confirmed" });
    expect(await countPendingRequests(provider)).toBe(1);

    // Customers and signed-out visitors have no requests to answer.
    expect(await countPendingRequests(customer)).toBe(0);
    expect(await countPendingRequests(null)).toBe(0);
  });
});

describe("updateBookingStatus", () => {
  it("rejects the customer confirming their own booking", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await expect(
      updateBookingStatus(customer, booking.id, { status: "confirmed" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("hides the booking's existence from an outsider", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const outsider = await createCustomerFixture("cust2");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await expect(
      updateBookingStatus(outsider, booking.id, { status: "cancelled", cancelReason: "x" }),
    ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND" });
  });

  it("requires a reason to cancel", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await expect(
      updateBookingStatus(customer, booking.id, { status: "cancelled" }),
    ).rejects.toMatchObject({ code: "CANCEL_REASON_REQUIRED" });
  });

  it("cancels overlapping requests when the provider confirms one", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const startAt = bookableSlot(2, 10);

    const bookingA = await createBooking(
      customer,
      validBookingInput(provider.id, {
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const bookingB = await createBooking(
      customer,
      validBookingInput(provider.id, {
        startAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
        endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      }),
    );

    const other = await createCustomerFixture("cust2");
    const bookingC = await createBooking(
      other,
      validBookingInput(provider.id, {
        startAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(startAt.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      }),
    );

    await updateBookingStatus(provider, bookingA.id, { status: "confirmed" });

    // B overlaps A (10-12 vs 11-13): cancelled, with a reason the customer can read.
    const b = await testOwnerDb.booking.findUniqueOrThrow({ where: { id: bookingB.id } });
    expect(b).toMatchObject({ status: "cancelled", cancelledBy: "provider" });
    expect(b.cancelReason).toContain("ยกเลิกอัตโนมัติ");
    // C starts when A ends (12-14): untouched.
    const c = await testOwnerDb.booking.findUniqueOrThrow({ where: { id: bookingC.id } });
    expect(c.status).toBe("pending");

    await expect(
      updateBookingStatus(provider, bookingB.id, { status: "confirmed" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("refuses a new request for time the provider already confirmed", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const other = await createCustomerFixture("cust2");
    const startAt = bookableSlot(2, 10);
    const hour = 60 * 60 * 1000;
    const at = (from: number, to: number) => ({
      startAt: new Date(startAt.getTime() + from * hour).toISOString(),
      endAt: new Date(startAt.getTime() + to * hour).toISOString(),
    });

    const confirmed = await createBooking(customer, validBookingInput(provider.id, at(0, 2)));
    await updateBookingStatus(provider, confirmed.id, { status: "confirmed" });

    await expect(
      createBooking(other, validBookingInput(provider.id, at(1, 3))),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    // Right after the confirmed job is fine.
    await expect(createBooking(other, validBookingInput(provider.id, at(2, 3)))).resolves.toBeTruthy();
  });

  it("lets only one of two concurrent confirms succeed", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const startAt = bookableSlot(2, 10);

    const bookingA = await createBooking(
      customer,
      validBookingInput(provider.id, {
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const bookingB = await createBooking(
      customer,
      validBookingInput(provider.id, {
        startAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
        endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      }),
    );

    const results = await Promise.allSettled([
      updateBookingStatus(provider, bookingA.id, { status: "confirmed" }),
      updateBookingStatus(provider, bookingB.id, { status: "confirmed" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    // The loser finds its request already cancelled by the winner -- a clean
    // error, never a deadlock.
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("increments completed_jobs when a booking is completed", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await updateBookingStatus(provider, booking.id, { status: "confirmed" });
    await updateBookingStatus(provider, booking.id, { status: "in_progress" });
    await updateBookingStatus(provider, booking.id, { status: "completed" });

    const row = await testOwnerDb.providerProfile.findUnique({
      where: { id: provider.id },
      select: { completedJobs: true },
    });
    expect(row?.completedJobs).toBe(1);
  });
});

describe("booking status emails", () => {
  /** The email to `to` whose subject contains `subject` (sending isn't awaited, so wait briefly). */
  async function emailTo(to: string, subject: string) {
    for (let i = 0; i < 100; i++) {
      const found = mail.sent.find((m) => m.to === to && m.subject.includes(subject));
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`No email to ${to} with "${subject}" in the subject`);
  }
  const linkPath = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).pathname;

  it("tells the customer when the provider confirms", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await updateBookingStatus(provider, booking.id, { status: "confirmed" });

    const email = await emailTo("cust1@test.local", "ยืนยันงาน");
    expect(email.subject).toBe("prov1 ยืนยันงานของคุณแล้ว - ช่างดี");
    expect(email.text).toContain("ช่างไฟฟ้า");
    expect(linkPath(email.text)).toBe(`/bookings/${booking.id}`);
  });

  it("tells a customer whose overlapping request was cancelled, with a link to rebook", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const other = await createCustomerFixture("cust2");
    const booking = await createBooking(customer, validBookingInput(provider.id));
    await createBooking(other, validBookingInput(provider.id));

    await updateBookingStatus(provider, booking.id, { status: "confirmed" });

    const email = await emailTo("cust2@test.local", "ไม่ว่าง");
    expect(email.subject).toBe("prov1 ไม่ว่างในเวลาที่คุณขอ - ช่างดี");
    expect(email.text).toContain("ยกเลิกอัตโนมัติ");
    expect(linkPath(email.text)).toBe(`/book/${provider.id}`);
  });

  it("links the customer to the review page when the job is completed", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await updateBookingStatus(provider, booking.id, { status: "confirmed" });
    await updateBookingStatus(provider, booking.id, { status: "in_progress" });
    await updateBookingStatus(provider, booking.id, { status: "completed" });

    const email = await emailTo("cust1@test.local", "ช่วยรีวิว prov1");
    expect(linkPath(email.text)).toBe(`/bookings/${booking.id}/review`);
  });

  it("tells the other side about a cancellation, with the reason", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await updateBookingStatus(customer, booking.id, {
      status: "cancelled",
      cancelReason: "ติดธุระด่วน",
    });

    const email = await emailTo("prov1@test.local", "ยกเลิก");
    expect(email.subject).toBe("cust1 ยกเลิกงานช่างไฟฟ้า - ช่างดี");
    expect(email.text).toContain("ติดธุระด่วน");
    // The one who cancelled isn't emailed about their own action.
    expect(mail.sent.some((m) => m.to === "cust1@test.local")).toBe(false);
  });

  it("doesn't email when the job starts", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));
    await updateBookingStatus(provider, booking.id, { status: "confirmed" });
    await emailTo("cust1@test.local", "ยืนยันงาน");

    await updateBookingStatus(provider, booking.id, { status: "in_progress" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mail.sent.filter((m) => m.to === "cust1@test.local")).toHaveLength(1);
  });

  it("doesn't email when the change fails", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await expect(
      updateBookingStatus(customer, booking.id, { status: "confirmed" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mail.sent.some((m) => m.to === "cust1@test.local")).toBe(false);
  });
});
