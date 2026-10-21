import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { bookingColumns } from "@/server/services/booking";
import {
  bookings,
  categories,
  profileContacts,
  profiles,
  providerProfiles,
} from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import type { BookingStatus } from "@/lib/validations/booking";

const CONTACT_VISIBLE_STATUSES: BookingStatus[] = ["confirmed", "in_progress", "completed"];

async function loadBookingParties(bookingId: string) {
  const [booking] = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      providerId: bookings.providerId,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  return booking;
}

function assertVisible(
  booking: { customerId: string; providerId: string } | undefined,
  actor: Actor,
): asserts booking {
  if (!booking) throw new AppError("BOOKING_NOT_FOUND");
  const isParty = booking.customerId === actor.id || booking.providerId === actor.id;
  if (!isParty && actor.role !== "admin") throw new AppError("BOOKING_NOT_FOUND");
}

export interface BookingContactDto {
  phone: string | null;
  lineId: string | null;
}

/**
 * The only way to see the other party's phone/LINE (SPEC.md section 7.4):
 * locked until the booking reaches confirmed/in_progress/completed.
 */
export async function getBookingContact(
  actor: Actor | null,
  bookingId: string,
): Promise<BookingContactDto> {
  if (!actor) throw new AppError("UNAUTHORIZED");
  const booking = await loadBookingParties(bookingId);
  assertVisible(booking, actor);

  if (!CONTACT_VISIBLE_STATUSES.includes(booking.status)) {
    throw new AppError("CONTACT_LOCKED");
  }

  const otherPartyId = booking.customerId === actor.id ? booking.providerId : booking.customerId;
  const [contact] = await db
    .select({ phone: profileContacts.phone, lineId: profileContacts.lineId })
    .from(profileContacts)
    .where(eq(profileContacts.id, otherPartyId));

  return contact ?? { phone: null, lineId: null };
}

export interface BookingListItemDto {
  id: string;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  counterpartyName: string;
  categoryNameTh: string;
}

/** Bookings where `actor` is the customer or the provider, newest request first. */
export async function listMyBookings(
  actor: Actor | null,
  status?: BookingStatus,
): Promise<BookingListItemDto[]> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      categoryNameTh: categories.nameTh,
      customerId: bookings.customerId,
      customerName: profiles.fullName,
      providerName: providerProfiles.displayName,
    })
    .from(bookings)
    .innerJoin(categories, eq(categories.id, bookings.categoryId))
    .innerJoin(profiles, eq(profiles.id, bookings.customerId))
    .innerJoin(providerProfiles, eq(providerProfiles.id, bookings.providerId))
    .where(
      and(
        or(eq(bookings.customerId, actor.id), eq(bookings.providerId, actor.id)),
        status ? eq(bookings.status, status) : undefined,
      ),
    )
    .orderBy(desc(bookings.createdAt));

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    startAt: row.startAt,
    endAt: row.endAt,
    categoryNameTh: row.categoryNameTh,
    counterpartyName: actor.id === row.customerId ? row.providerName : row.customerName,
  }));
}

export type BookingDetailDto = Awaited<ReturnType<typeof getBookingDetail>>;

/** Full booking detail + timeline fields, for the customer/provider job page. */
export async function getBookingDetail(actor: Actor | null, bookingId: string) {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const [row] = await db
    .select({
      ...bookingColumns,
      categoryNameTh: categories.nameTh,
      customerName: profiles.fullName,
      providerDisplayName: providerProfiles.displayName,
    })
    .from(bookings)
    .innerJoin(categories, eq(categories.id, bookings.categoryId))
    .innerJoin(profiles, eq(profiles.id, bookings.customerId))
    .innerJoin(providerProfiles, eq(providerProfiles.id, bookings.providerId))
    .where(eq(bookings.id, bookingId));

  assertVisible(row, actor);
  return row;
}
