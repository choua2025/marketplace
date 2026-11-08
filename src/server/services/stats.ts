import { db } from "@/server/db/client";
import type { Actor } from "@/server/lib/actor";
import { hueFromString, nameInitial } from "@/lib/avatar-initial";
import { getSignedImageUrl } from "@/server/services/upload";

const RECENT_CUSTOMER_COUNT = 5;

export interface PublicStatsDto {
  verifiedProviders: number;
  completedBookings: number;
  customers: number;
  avgRating: number | null;
  /**
   * Newest customers for the homepage avatar row: a first letter + color,
   * plus a photo only for customers who opted in (profiles.show_on_homepage).
   * Full names and ids stay server-side.
   */
  recentCustomers: { initial: string; hue: number; imageUrl: string | null }[];
}

/** Public: homepage headline numbers -- real counts, never placeholder marketing figures. */
export async function getPublicStats(_actor: Actor | null): Promise<PublicStatsDto> {
  const select = { id: true, fullName: true, avatarKey: true } as const;
  const [verifiedProviders, completedBookings, customers, ratingAgg, withPhoto, recent] =
    await Promise.all([
      db.providerProfile.count({ where: { isVerified: true } }),
      db.booking.count({ where: { status: "completed" } }),
      db.profile.count({ where: { role: "customer" } }),
      db.review.aggregate({ _avg: { rating: true } }),
      // Opted-in customers with a photo come first...
      db.profile.findMany({
        where: { role: "customer", showOnHomepage: true, avatarKey: { not: null } },
        orderBy: { createdAt: "desc" },
        take: RECENT_CUSTOMER_COUNT,
        select,
      }),
      // ...then the newest of everyone else fill the row as initials.
      db.profile.findMany({
        where: { role: "customer", NOT: { showOnHomepage: true, avatarKey: { not: null } } },
        orderBy: { createdAt: "desc" },
        take: RECENT_CUSTOMER_COUNT,
        select,
      }),
    ]);

  const row = [
    ...withPhoto.map((c) => ({ ...c, showPhoto: true })),
    ...recent.map((c) => ({ ...c, showPhoto: false })),
  ].slice(0, RECENT_CUSTOMER_COUNT);

  return {
    verifiedProviders,
    completedBookings,
    customers,
    avgRating: ratingAgg._avg.rating,
    recentCustomers: await Promise.all(
      row.map(async (c) => ({
        initial: nameInitial(c.fullName),
        hue: hueFromString(c.id),
        imageUrl: c.showPhoto ? await getSignedImageUrl(c.avatarKey) : null,
      })),
    ),
  };
}
