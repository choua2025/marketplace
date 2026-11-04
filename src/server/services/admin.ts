import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import type { BookingStatus } from "@/lib/validations/booking";

function assertAdmin(actor: Actor | null): Actor {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "admin") throw new AppError("FORBIDDEN");
  return actor;
}

export interface AdminStatsDto {
  totalCustomers: number;
  totalProviders: number;
  pendingVerifications: number;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
}

/** Admin dashboard home: headline counts across the whole marketplace. */
export async function getAdminStats(actor: Actor | null): Promise<AdminStatsDto> {
  assertAdmin(actor);

  const [totalCustomers, totalProviders, pendingVerifications, bookingGroups] = await Promise.all([
    db.profile.count({ where: { role: "customer" } }),
    db.profile.count({ where: { role: "provider" } }),
    db.providerVerification.count({ where: { status: "pending" } }),
    db.booking.groupBy({ by: ["status"], _count: true }),
  ]);

  const bookingsByStatus = Object.fromEntries(
    bookingGroups.map((g) => [g.status, g._count]),
  ) as Partial<Record<BookingStatus, number>>;

  return { totalCustomers, totalProviders, pendingVerifications, bookingsByStatus };
}

export const ADMIN_PAGE_SIZE = 20;

export interface Paginated<T> {
  items: T[];
  total: number;
  /** 1-based, clamped to the last page that exists. */
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Parses a ?page= value: anything missing or invalid means page 1. */
export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pageWindow(total: number, requestedPage = 1, pageSize = ADMIN_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages);
  return { page, pageSize, totalPages, skip: (page - 1) * pageSize };
}

function contains(q: string) {
  return { contains: q, mode: "insensitive" as const };
}

/** Trimmed search text, or undefined when there's nothing to search for. */
function normalizeQuery(q: string | undefined): string | undefined {
  const trimmed = q?.trim().slice(0, 100);
  return trimmed ? trimmed : undefined;
}

/**
 * Phones are stored as "+66811111111" but admins type "081-111-1111".
 * For a phone-looking query, match the digits with any leading 0 dropped
 * (the national trunk prefix that "+66" / "+856" replaces).
 */
function phoneQuery(q: string): string | undefined {
  if (!/^[\d\s+\-().]+$/.test(q)) return undefined;
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  return digits.length >= 3 ? digits : undefined;
}

function phoneConditions(q: string) {
  const digits = phoneQuery(q);
  return [
    { user: { phoneNumber: contains(q) } },
    { contact: { phone: contains(q) } },
    ...(digits
      ? [{ user: { phoneNumber: contains(digits) } }, { contact: { phone: contains(digits) } }]
      : []),
  ];
}

export interface AdminCustomerListItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  bookingCount: number;
  createdAt: Date;
}

/** Admin: customers, newest first, paginated and optionally searched by name, email or phone. */
export async function listCustomersForAdmin(
  actor: Actor | null,
  options: { q?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<AdminCustomerListItemDto>> {
  assertAdmin(actor);
  const q = normalizeQuery(options.q);

  const where = {
    role: "customer" as const,
    ...(q
      ? {
          OR: [{ fullName: contains(q) }, { user: { email: contains(q) } }, ...phoneConditions(q)],
        }
      : {}),
  };
  const total = await db.profile.count({ where });
  const { page, pageSize, totalPages, skip } = pageWindow(total, options.page, options.pageSize);

  const rows = await db.profile.findMany({
    where,
    // id breaks ties so rows never repeat or go missing across pages.
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      fullName: true,
      createdAt: true,
      user: { select: { email: true, phoneNumber: true } },
      contact: { select: { phone: true } },
      _count: { select: { bookings: true } },
    },
  });

  const items = rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    email: row.user.email,
    phone: row.contact?.phone ?? row.user.phoneNumber ?? null,
    bookingCount: row._count.bookings,
    createdAt: row.createdAt,
  }));
  return { items, total, page, pageSize, totalPages };
}

export const PROVIDER_FILTERS = ["all", "pending", "verified", "inactive"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

export interface AdminProviderListItemDto {
  id: string;
  displayName: string;
  ownerName: string;
  email: string;
  areaLabel: string | null;
  isActive: boolean;
  isVerified: boolean;
  ratingAvg: string;
  ratingCount: number;
  completedJobs: number;
  verificationStatus: "pending" | "approved" | "rejected" | null;
  createdAt: Date;
}

/**
 * Admin: provider profiles, newest first, paginated. Searchable by shop
 * name, owner name, email or area; filterable by verification/active status.
 */
export async function listProvidersForAdmin(
  actor: Actor | null,
  options: { q?: string; filter?: ProviderFilter; page?: number; pageSize?: number } = {},
): Promise<Paginated<AdminProviderListItemDto>> {
  assertAdmin(actor);
  const q = normalizeQuery(options.q);
  const filter = options.filter ?? "all";

  const where = {
    ...(q
      ? {
          OR: [
            { displayName: contains(q) },
            { areaLabel: contains(q) },
            { profile: { fullName: contains(q) } },
            { profile: { user: { email: contains(q) } } },
          ],
        }
      : {}),
    ...(filter === "pending" ? { verification: { status: "pending" as const } } : {}),
    ...(filter === "verified" ? { isVerified: true } : {}),
    ...(filter === "inactive" ? { isActive: false } : {}),
  };
  const total = await db.providerProfile.count({ where });
  const { page, pageSize, totalPages, skip } = pageWindow(total, options.page, options.pageSize);

  const rows = await db.providerProfile.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      displayName: true,
      areaLabel: true,
      isActive: true,
      isVerified: true,
      ratingAvg: true,
      ratingCount: true,
      completedJobs: true,
      createdAt: true,
      verification: { select: { status: true } },
      profile: { select: { fullName: true, user: { select: { email: true } } } },
    },
  });

  const items = rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    ownerName: row.profile.fullName,
    email: row.profile.user.email,
    areaLabel: row.areaLabel,
    isActive: row.isActive,
    isVerified: row.isVerified,
    ratingAvg: row.ratingAvg.toFixed(2),
    ratingCount: row.ratingCount,
    completedJobs: row.completedJobs,
    verificationStatus: row.verification?.status ?? null,
    createdAt: row.createdAt,
  }));
  return { items, total, page, pageSize, totalPages };
}

export interface AdminBookingListItemDto {
  id: string;
  status: BookingStatus;
  customerName: string;
  providerName: string;
  startAt: Date;
  createdAt: Date;
}

/** Admin: bookings, newest request first, paginated and optionally filtered by status. */
export async function listBookingsForAdmin(
  actor: Actor | null,
  options: { status?: BookingStatus; page?: number; pageSize?: number } = {},
): Promise<Paginated<AdminBookingListItemDto>> {
  assertAdmin(actor);

  const where = options.status ? { status: options.status } : {};
  const total = await db.booking.count({ where });
  const { page, pageSize, totalPages, skip } = pageWindow(total, options.page, options.pageSize);

  const rows = await db.booking.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      status: true,
      startAt: true,
      createdAt: true,
      customer: { select: { fullName: true } },
      provider: { select: { displayName: true } },
    },
  });

  const items = rows.map((row) => ({
    id: row.id,
    status: row.status,
    startAt: row.startAt,
    createdAt: row.createdAt,
    customerName: row.customer.fullName,
    providerName: row.provider.displayName,
  }));
  return { items, total, page, pageSize, totalPages };
}
