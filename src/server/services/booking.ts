import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  availabilityRules,
  bookings,
  categories,
  providerCategories,
  providerProfiles,
} from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { getPgErrorCode } from "@/server/lib/db-errors";
import type { Actor } from "@/server/lib/actor";
import {
  createBookingSchema,
  updateBookingStatusSchema,
  type BookingStatus,
} from "@/lib/validations/booking";

const MIN_LEAD_TIME_MS = 60 * 60 * 1000; // 1 hour
const MAX_LEAD_TIME_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_PENDING_BOOKINGS = 5;

export const bookingColumns = {
  id: bookings.id,
  customerId: bookings.customerId,
  providerId: bookings.providerId,
  categoryId: bookings.categoryId,
  status: bookings.status,
  startAt: bookings.startAt,
  endAt: bookings.endAt,
  description: bookings.description,
  address: bookings.address,
  photoKeys: bookings.photoKeys,
  cancelledBy: bookings.cancelledBy,
  cancelReason: bookings.cancelReason,
  confirmedAt: bookings.confirmedAt,
  startedAt: bookings.startedAt,
  completedAt: bookings.completedAt,
  cancelledAt: bookings.cancelledAt,
  createdAt: bookings.createdAt,
};

export type BookingDto = Awaited<ReturnType<typeof createBooking>>;

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Weekday (0=Sun) and "HH:MM:SS" time-of-day, both in the given IANA timezone. */
function getLocalWeekdayAndTime(date: Date, timeZone: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const weekdayPart = parts.find((p) => p.type === "weekday")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const second = parts.find((p) => p.type === "second")?.value;
  const weekday = weekdayPart ? WEEKDAY_SHORT_TO_INDEX[weekdayPart] : undefined;

  if (weekday === undefined || !hour || !minute || !second) {
    throw new Error(`Failed to compute local weekday/time for timezone ${timeZone}`);
  }

  return { weekday, time: `${hour}:${minute}:${second}` };
}

/**
 * Creates a pending booking request (SPEC.md section 7.2). Every condition
 * is checked inside one transaction, with the provider row locked first --
 * overlapping *pending* requests are allowed on purpose; the provider
 * picks which one to confirm, and confirming is where the real
 * double-booking guard (the DB exclusion constraint) kicks in.
 */
export async function createBooking(actor: Actor | null, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "customer") throw new AppError("FORBIDDEN");

  const parsed = createBookingSchema.parse(input);

  return db.transaction(async (tx) => {
    const [provider] = await tx
      .select({
        id: providerProfiles.id,
        isActive: providerProfiles.isActive,
        timezone: providerProfiles.timezone,
      })
      .from(providerProfiles)
      .where(eq(providerProfiles.id, parsed.providerId))
      .for("update");

    if (!provider || !provider.isActive) throw new AppError("PROVIDER_UNAVAILABLE");

    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, parsed.categorySlug));
    if (!category) throw new AppError("CATEGORY_NOT_OFFERED");

    const [offered] = await tx
      .select({ categoryId: providerCategories.categoryId })
      .from(providerCategories)
      .where(
        and(
          eq(providerCategories.providerId, provider.id),
          eq(providerCategories.categoryId, category.id),
        ),
      );
    if (!offered) throw new AppError("CATEGORY_NOT_OFFERED");

    const now = Date.now();
    const startMs = parsed.startAt.getTime();
    if (startMs < now + MIN_LEAD_TIME_MS || startMs > now + MAX_LEAD_TIME_MS) {
      throw new AppError("INVALID_START_TIME");
    }

    const { weekday, time: startTime } = getLocalWeekdayAndTime(parsed.startAt, provider.timezone);
    const { time: endTime } = getLocalWeekdayAndTime(parsed.endAt, provider.timezone);

    const rules = await tx
      .select({ startTime: availabilityRules.startTime, endTime: availabilityRules.endTime })
      .from(availabilityRules)
      .where(
        and(eq(availabilityRules.providerId, provider.id), eq(availabilityRules.weekday, weekday)),
      );

    const fitsAvailability = rules.some(
      (rule) => startTime >= rule.startTime && endTime <= rule.endTime,
    );
    if (!fitsAvailability) throw new AppError("OUTSIDE_WORKING_HOURS");

    const [pendingCount] = await tx
      .select({ value: count() })
      .from(bookings)
      .where(and(eq(bookings.customerId, actor.id), eq(bookings.status, "pending")));
    if ((pendingCount?.value ?? 0) >= MAX_PENDING_BOOKINGS) {
      throw new AppError("TOO_MANY_PENDING_BOOKINGS");
    }

    const [created] = await tx
      .insert(bookings)
      .values({
        customerId: actor.id,
        providerId: provider.id,
        categoryId: category.id,
        status: "pending",
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        description: parsed.description,
        address: parsed.address,
        photoKeys: parsed.photoKeys,
      })
      .returning(bookingColumns);

    if (!created) throw new Error("failed to insert booking");
    return created;
  });
}

type TransitionActor = "customer" | "provider";

/** SPEC.md section 7.3's one-way state machine. */
function isValidTransition(
  current: BookingStatus,
  next: BookingStatus,
  by: TransitionActor,
): boolean {
  if (next === "cancelled") {
    return current === "pending" || current === "confirmed";
  }
  if (by !== "provider") return false;
  if (current === "pending" && next === "confirmed") return true;
  if (current === "confirmed" && next === "in_progress") return true;
  if (current === "in_progress" && next === "completed") return true;
  return false;
}

/**
 * Advances a booking's status (SPEC.md section 7.3). Locks the row first,
 * then validates the transition; confirming can still lose a race to the
 * no_double_booking exclusion constraint (23P01), which we translate to
 * SLOT_TAKEN here rather than let a raw Postgres error leak out.
 */
export async function updateBookingStatus(actor: Actor | null, bookingId: string, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  const parsed = updateBookingStatusSchema.parse(input);

  return db.transaction(async (tx) => {
    const [booking] = await tx
      .select(bookingColumns)
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    if (!booking) throw new AppError("BOOKING_NOT_FOUND");

    const isCustomer = booking.customerId === actor.id;
    const isProvider = booking.providerId === actor.id;
    // Not a party to this booking -- BOOKING_NOT_FOUND, never FORBIDDEN, so
    // an outsider can't tell the booking exists at all (SPEC.md section 7.3).
    if (!isCustomer && !isProvider) throw new AppError("BOOKING_NOT_FOUND");
    const by: TransitionActor = isProvider ? "provider" : "customer";

    if (!isValidTransition(booking.status, parsed.status, by)) {
      throw new AppError("INVALID_TRANSITION");
    }
    if (parsed.status === "cancelled" && !parsed.cancelReason) {
      throw new AppError("CANCEL_REASON_REQUIRED");
    }

    const now = new Date();
    const patch: Partial<typeof bookings.$inferInsert> = { status: parsed.status };
    if (parsed.status === "confirmed") patch.confirmedAt = now;
    if (parsed.status === "in_progress") patch.startedAt = now;
    if (parsed.status === "completed") patch.completedAt = now;
    if (parsed.status === "cancelled") {
      patch.cancelledAt = now;
      patch.cancelledBy = by;
      patch.cancelReason = parsed.cancelReason;
    }

    let updated;
    try {
      [updated] = await tx
        .update(bookings)
        .set(patch)
        .where(eq(bookings.id, bookingId))
        .returning(bookingColumns);
    } catch (error) {
      if (getPgErrorCode(error) === "23P01") throw new AppError("SLOT_TAKEN");
      throw error;
    }
    if (!updated) throw new Error("failed to update booking");

    if (parsed.status === "completed") {
      await tx
        .update(providerProfiles)
        .set({ completedJobs: sql`${providerProfiles.completedJobs} + 1` })
        .where(eq(providerProfiles.id, booking.providerId));
    }

    return updated;
  });
}
