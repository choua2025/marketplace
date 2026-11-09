import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { getSignedImageUrl } from "@/server/services/upload";

function assertCustomer(actor: Actor | null): Actor {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "customer") throw new AppError("FORBIDDEN");
  return actor;
}

/** Adds a provider to the customer's favorites. Idempotent. */
export async function addFavorite(actor: Actor | null, providerId: string): Promise<void> {
  const customer = assertCustomer(actor);
  await enforceRateLimit("favorite", customer.id);

  const provider = await db.providerProfile.findUnique({
    where: { id: providerId },
    select: { id: true },
  });
  if (!provider) throw new AppError("NOT_FOUND");

  await db.favorite.upsert({
    where: { customerId_providerId: { customerId: customer.id, providerId } },
    create: { customerId: customer.id, providerId },
    update: {},
  });
}

/** Removes a provider from the customer's favorites. Idempotent. */
export async function removeFavorite(actor: Actor | null, providerId: string): Promise<void> {
  const customer = assertCustomer(actor);
  await enforceRateLimit("favorite", customer.id);
  await db.favorite.deleteMany({ where: { customerId: customer.id, providerId } });
}

/** Whether the current customer has favorited this provider -- false for
 * anonymous visitors and non-customers, never throws. */
export async function isFavorited(actor: Actor | null, providerId: string): Promise<boolean> {
  if (!actor || actor.role !== "customer") return false;
  const row = await db.favorite.findUnique({
    where: { customerId_providerId: { customerId: actor.id, providerId } },
    select: { customerId: true },
  });
  return row !== null;
}

/** Bulk check for rendering a list of search results -- which of these
 * provider ids has the current actor favorited? Empty set for anonymous
 * visitors and non-customers, never throws. */
export async function listFavoritedProviderIds(
  actor: Actor | null,
  providerIds: string[],
): Promise<Set<string>> {
  if (!actor || actor.role !== "customer" || providerIds.length === 0) return new Set();

  const rows = await db.favorite.findMany({
    where: { customerId: actor.id, providerId: { in: providerIds } },
    select: { providerId: true },
  });
  return new Set(rows.map((row) => row.providerId));
}

export interface FavoriteProviderDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
  areaLabel: string | null;
  isVerified: boolean;
  ratingAvg: string;
  ratingCount: number;
}

/** Every provider the customer has favorited, newest first. */
export async function listMyFavorites(actor: Actor | null): Promise<FavoriteProviderDto[]> {
  const customer = assertCustomer(actor);

  const rows = await db.favorite.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: {
      provider: {
        select: {
          id: true,
          displayName: true,
          basePrice: true,
          priceUnit: true,
          areaLabel: true,
          isVerified: true,
          ratingAvg: true,
          ratingCount: true,
          profile: { select: { avatarKey: true } },
        },
      },
    },
  });

  return Promise.all(
    rows.map(async (row) => ({
      id: row.provider.id,
      displayName: row.provider.displayName,
      avatarUrl: await getSignedImageUrl(row.provider.profile.avatarKey),
      basePrice: row.provider.basePrice.toFixed(2),
      priceUnit: row.provider.priceUnit,
      areaLabel: row.provider.areaLabel,
      isVerified: row.provider.isVerified,
      ratingAvg: row.provider.ratingAvg.toFixed(2),
      ratingCount: row.provider.ratingCount,
    })),
  );
}
