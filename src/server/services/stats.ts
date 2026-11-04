import { db } from "@/server/db/client";
import type { Actor } from "@/server/lib/actor";
import { hueFromString, nameInitial } from "@/lib/avatar-initial";

const RECENT_CUSTOMER_COUNT = 5;

export interface PublicStatsDto {
  verifiedProviders: number;
  completedBookings: number;
  customers: number;
  avgRating: number | null;
  /**
   * Newest customers as a first letter + color only. Customer photos and
   * full names are private (customers never agreed to appear publicly),
   * and ids stay server-side.
   */
  recentCustomers: { initial: string; hue: number }[];
}

/** Public: homepage headline numbers -- real counts, never placeholder marketing figures. */
export async function getPublicStats(_actor: Actor | null): Promise<PublicStatsDto> {
  const [verifiedProviders, completedBookings, customers, ratingAgg, recent] = await Promise.all([
    db.providerProfile.count({ where: { isVerified: true } }),
    db.booking.count({ where: { status: "completed" } }),
    db.profile.count({ where: { role: "customer" } }),
    db.review.aggregate({ _avg: { rating: true } }),
    db.profile.findMany({
      where: { role: "customer" },
      orderBy: { createdAt: "desc" },
      take: RECENT_CUSTOMER_COUNT,
      select: { id: true, fullName: true },
    }),
  ]);

  return {
    verifiedProviders,
    completedBookings,
    customers,
    avgRating: ratingAgg._avg.rating,
    recentCustomers: recent.map((c) => ({
      initial: nameInitial(c.fullName),
      hue: hueFromString(c.id),
    })),
  };
}
