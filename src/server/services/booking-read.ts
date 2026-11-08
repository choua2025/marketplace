import { db } from "@/server/db/client";
import { bookingSelect } from "@/server/services/booking";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import { MAX_LEAD_TIME_MS, type BookingStatus } from "@/lib/validations/booking";
import type { BusyRange } from "@/lib/booking-slots";

const CONTACT_VISIBLE_STATUSES: BookingStatus[] = ["confirmed", "in_progress", "completed"];

async function loadBookingParties(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, customerId: true, providerId: true, status: true },
  });
}

function assertVisible(
  booking: { customerId: string; providerId: string } | null,
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
  const contact = await db.profileContact.findUnique({
    where: { id: otherPartyId },
    select: { phone: true, lineId: true },
  });

  return contact ?? { phone: null, lineId: null };
}

export interface BookingListItemDto {
  id: string;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  counterpartyName: string;
  categoryNameTh: string;
  categoryNameEn: string;
  categoryIcon: string;
}

/** Bookings where `actor` is the customer or the provider, newest request first. */
export async function listMyBookings(
  actor: Actor | null,
  status?: BookingStatus,
): Promise<BookingListItemDto[]> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const rows = await db.booking.findMany({
    where: {
      OR: [{ customerId: actor.id }, { providerId: actor.id }],
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      customerId: true,
      category: { select: { nameTh: true, nameEn: true, icon: true } },
      customer: { select: { fullName: true } },
      provider: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    startAt: row.startAt,
    endAt: row.endAt,
    categoryNameTh: row.category.nameTh,
    categoryNameEn: row.category.nameEn,
    categoryIcon: row.category.icon,
    counterpartyName:
      actor.id === row.customerId ? row.provider.displayName : row.customer.fullName,
  }));
}

/**
 * For the header's badge on the provider's jobs icon: booking requests still
 * waiting for them to accept or decline. 0 for anyone who isn't a provider.
 */
export async function countPendingRequests(actor: Actor | null): Promise<number> {
  if (actor?.role !== "provider") return 0;
  return db.booking.count({ where: { providerId: actor.id, status: "pending" } });
}

/**
 * When the provider is already booked (confirmed or in progress), for the
 * booking form's time picker. Only the times -- never who or what for.
 */
export async function listBusyTimes(providerId: string): Promise<BusyRange[]> {
  const now = new Date();
  const rows = await db.booking.findMany({
    where: {
      providerId,
      status: { in: ["confirmed", "in_progress"] },
      endAt: { gt: now },
      startAt: { lt: new Date(now.getTime() + MAX_LEAD_TIME_MS) },
    },
    select: { startAt: true, endAt: true },
    orderBy: { startAt: "asc" },
  });
  return rows.map((row) => ({ start: row.startAt.getTime(), end: row.endAt.getTime() }));
}

export type BookingDetailDto = Awaited<ReturnType<typeof getBookingDetail>>;

/** Full booking detail + timeline fields, for the customer/provider job page. */
export async function getBookingDetail(actor: Actor | null, bookingId: string) {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const row = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      ...bookingSelect,
      category: { select: { nameTh: true, nameEn: true } },
      customer: { select: { fullName: true, avatarKey: true } },
      provider: { select: { displayName: true, profile: { select: { avatarKey: true } } } },
    },
  });

  assertVisible(row, actor);

  const { category, customer, provider, ...booking } = row;
  return {
    ...booking,
    categoryNameTh: category.nameTh,
    categoryNameEn: category.nameEn,
    customerName: customer.fullName,
    customerAvatarKey: customer.avatarKey,
    providerDisplayName: provider.displayName,
    providerAvatarKey: provider.profile.avatarKey,
  };
}
