import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createBooking, updateBookingStatus } from "@/server/services/booking";
import { getBookingContact } from "@/server/services/booking-read";
import type { Actor } from "@/server/lib/actor";
import {
  availabilityRules,
  categories,
  providerCategories,
  providerProfiles,
  profileContacts,
  profiles,
  user,
} from "@/server/db/schema";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

const WEEKDAYS_MON_SAT = [1, 2, 3, 4, 5, 6];

async function createProviderWithAvailability(id: string, categorySlug = "electrician") {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "provider", fullName: id });
  await testOwnerDb.insert(profileContacts).values({ id, phone: "+66820000000" });
  await testOwnerDb
    .insert(providerProfiles)
    .values({ id, displayName: id, isActive: true, latitude: "13.75", longitude: "100.50" });

  const [category] = await testOwnerDb
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, categorySlug));
  if (category) {
    await testOwnerDb
      .insert(providerCategories)
      .values({ providerId: id, categoryId: category.id });
  }

  await testOwnerDb.insert(availabilityRules).values(
    WEEKDAYS_MON_SAT.map((weekday) => ({
      providerId: id,
      weekday,
      startTime: "08:00:00",
      endTime: "18:00:00",
    })),
  );

  return { id, role: "provider" as const } satisfies Actor;
}

async function createCustomerFixture(id: string): Promise<Actor> {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "customer", fullName: id });
  await testOwnerDb.insert(profileContacts).values({ id, phone: "+66800000000" });
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

beforeEach(async () => {
  await resetTestDatabase();
  await testOwnerDb.insert(categories).values([
    { slug: "electrician", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", icon: "zap" },
    { slug: "plumber", nameTh: "ช่างประปา", nameEn: "Plumber", icon: "wrench" },
  ]);
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
    await testOwnerDb
      .update(providerProfiles)
      .set({ isActive: false })
      .where(eq(providerProfiles.id, provider.id));

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

  it("returns SLOT_TAKEN when confirming a second overlapping booking", async () => {
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

    await updateBookingStatus(provider, bookingA.id, { status: "confirmed" });
    await expect(
      updateBookingStatus(provider, bookingB.id, { status: "confirmed" }),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
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
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("increments completed_jobs when a booking is completed", async () => {
    const provider = await createProviderWithAvailability("prov1");
    const customer = await createCustomerFixture("cust1");
    const booking = await createBooking(customer, validBookingInput(provider.id));

    await updateBookingStatus(provider, booking.id, { status: "confirmed" });
    await updateBookingStatus(provider, booking.id, { status: "in_progress" });
    await updateBookingStatus(provider, booking.id, { status: "completed" });

    const [row] = await testOwnerDb
      .select({ completedJobs: providerProfiles.completedJobs })
      .from(providerProfiles)
      .where(eq(providerProfiles.id, provider.id));
    expect(row?.completedJobs).toBe(1);
  });
});
