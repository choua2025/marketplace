import { db } from "@/server/db/client";
import { Prisma } from "@/server/db/generated/prisma/client";
import { AppError } from "@/server/lib/errors";
import { getPgErrorCode } from "@/server/lib/db-errors";
import { dateToTimeString } from "@/server/lib/pg-time";
import type { Actor } from "@/server/lib/actor";
import { notifyNewBooking } from "@/server/services/notifications";
import {
  createBookingSchema,
  MAX_LEAD_TIME_MS,
  MIN_LEAD_TIME_MS,
  updateBookingStatusSchema,
  type BookingStatus,
} from "@/lib/validations/booking";

const MAX_PENDING_BOOKINGS = 5;

export const bookingSelect = {
  id: true,
  customerId: true,
  providerId: true,
  categoryId: true,
  status: true,
  startAt: true,
  endAt: true,
  description: true,
  address: true,
  photoKeys: true,
  cancelledBy: true,
  cancelReason: true,
  confirmedAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
} satisfies Prisma.BookingSelect;

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

  const result = createBookingSchema.safeParse(input);
  if (!result.success) {
    // A bad start/end pair gets its own message instead of the generic
    // "invalid data", since it's the mistake people actually make.
    if (result.error.issues.some((issue) => issue.path[0] === "endAt")) {
      throw new AppError("INVALID_TIME_RANGE");
    }
    throw result.error;
  }
  const parsed = result.data;

  const booking = await db.$transaction(async (tx) => {
    const [provider] = await tx.$queryRaw<{ id: string; isActive: boolean; timezone: string }[]>(
      Prisma.sql`SELECT "id", "is_active" AS "isActive", "timezone" FROM "provider_profiles" WHERE "id" = ${parsed.providerId} FOR UPDATE`,
    );

    if (!provider || !provider.isActive) throw new AppError("PROVIDER_UNAVAILABLE");

    const category = await tx.category.findUnique({
      where: { slug: parsed.categorySlug },
      select: { id: true },
    });
    if (!category) throw new AppError("CATEGORY_NOT_OFFERED");

    const offered = await tx.providerCategory.findUnique({
      where: { providerId_categoryId: { providerId: provider.id, categoryId: category.id } },
    });
    if (!offered) throw new AppError("CATEGORY_NOT_OFFERED");

    const now = Date.now();
    const startMs = parsed.startAt.getTime();
    if (startMs < now + MIN_LEAD_TIME_MS || startMs > now + MAX_LEAD_TIME_MS) {
      throw new AppError("INVALID_START_TIME");
    }

    const { weekday, time: startTime } = getLocalWeekdayAndTime(parsed.startAt, provider.timezone);
    const { time: endTime } = getLocalWeekdayAndTime(parsed.endAt, provider.timezone);

    const rules = await tx.availabilityRule.findMany({
      where: { providerId: provider.id, weekday },
      select: { startTime: true, endTime: true },
    });

    const fitsAvailability = rules.some(
      (rule) =>
        startTime >= dateToTimeString(rule.startTime) && endTime <= dateToTimeString(rule.endTime),
    );
    if (!fitsAvailability) throw new AppError("OUTSIDE_WORKING_HOURS");

    const pendingCount = await tx.booking.count({
      where: { customerId: actor.id, status: "pending" },
    });
    if (pendingCount >= MAX_PENDING_BOOKINGS) {
      throw new AppError("TOO_MANY_PENDING_BOOKINGS");
    }

    return tx.booking.create({
      data: {
        customerId: actor.id,
        providerId: provider.id,
        categoryId: category.id,
        status: "pending",
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        description: parsed.description,
        address: parsed.address,
        photoKeys: parsed.photoKeys,
      },
      select: bookingSelect,
    });
  });

  // After the commit, so the email never announces a booking that rolled back.
  notifyNewBooking(booking.id);
  return booking;
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

  return db.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT "id" FROM "bookings" WHERE "id" = ${bookingId} FOR UPDATE`,
    );
    if (!locked) throw new AppError("BOOKING_NOT_FOUND");

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: bookingSelect,
    });

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
    const patch: Prisma.BookingUpdateInput = { status: parsed.status };
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
      updated = await tx.booking.update({
        where: { id: bookingId },
        data: patch,
        select: bookingSelect,
      });
    } catch (error) {
      if (getPgErrorCode(error) === "23P01") throw new AppError("SLOT_TAKEN");
      throw error;
    }

    if (parsed.status === "completed") {
      await tx.providerProfile.update({
        where: { id: booking.providerId },
        data: { completedJobs: { increment: 1 } },
      });
    }

    return updated;
  });
}
