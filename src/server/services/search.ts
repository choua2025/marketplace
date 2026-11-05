import { db } from "@/server/db/client";
import { Prisma } from "@/server/db/generated/prisma/client";
import type { Actor } from "@/server/lib/actor";
import { searchProvidersSchema } from "@/lib/validations/search";
import { experienceYears } from "@/lib/experience";

export type SearchResultDto = {
  id: string;
  displayName: string;
  avatarKey: string | null;
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
  areaLabel: string | null;
  latitude: number;
  longitude: number;
  isVerified: boolean;
  experienceYears: number | null;
  ratingAvg: string;
  ratingCount: number;
  distanceKm: number;
};

/**
 * Public search (SPEC.md section 7.6). `actor` isn't used for permission
 * checks here -- search results are the same for everyone, including
 * anonymous visitors -- but every service function still takes it first
 * per SPEC.md section 5.1.
 */
export async function searchProviders(
  _actor: Actor | null,
  input: unknown,
): Promise<SearchResultDto[]> {
  const params = searchProvidersSchema.parse(input);

  const categoryFilter = params.categorySlug
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM provider_categories pc
        JOIN categories c ON c.id = pc.category_id
        WHERE pc.provider_id = pp.id AND c.slug = ${params.categorySlug}
      )`
    : Prisma.sql``;

  const minRatingFilter =
    params.minRating !== undefined
      ? Prisma.sql`AND pp.rating_avg >= ${params.minRating}`
      : Prisma.sql``;

  const maxPriceFilter =
    params.maxPrice !== undefined
      ? Prisma.sql`AND pp.base_price <= ${params.maxPrice}`
      : Prisma.sql``;

  const orderBy =
    params.sort === "distance"
      ? Prisma.sql`"distanceKm" ASC`
      : params.sort === "rating"
        ? Prisma.sql`"ratingAvg" DESC, "ratingCount" DESC`
        : params.sort === "price"
          ? Prisma.sql`"basePrice" ASC`
          : // recommended: verified first, then weighted rating, then distance
            Prisma.sql`"isVerified" DESC, (("ratingAvg"::numeric * "ratingCount" + 4.0 * 3) / ("ratingCount" + 3)) DESC, "distanceKm" ASC`;

  // base_price/rating_avg are NUMERIC columns -- Prisma's $queryRaw returns
  // those as Decimal objects even for raw SQL, not the plain strings the
  // `pg` driver alone would give. Converted below to match SearchResultDto.
  type RawRow = Omit<SearchResultDto, "basePrice" | "ratingAvg" | "experienceYears"> & {
    basePrice: Prisma.Decimal;
    ratingAvg: Prisma.Decimal;
    experienceSinceYear: number | null;
  };

  const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
    WITH candidates AS (
      SELECT
        pp.id AS id,
        pp.display_name AS "displayName",
        p.avatar_key AS "avatarKey",
        pp.base_price AS "basePrice",
        pp.price_unit AS "priceUnit",
        pp.area_label AS "areaLabel",
        ROUND(pp.latitude::numeric, 3)::float8 AS latitude,
        ROUND(pp.longitude::numeric, 3)::float8 AS longitude,
        pp.is_verified AS "isVerified",
        pp.experience_since_year AS "experienceSinceYear",
        pp.rating_avg AS "ratingAvg",
        pp.rating_count AS "ratingCount",
        pp.service_radius_km AS "serviceRadiusKm",
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${params.lat})) * cos(radians(pp.latitude)) * cos(radians(pp.longitude) - radians(${params.lng})) +
            sin(radians(${params.lat})) * sin(radians(pp.latitude))
          ))
        )) AS "distanceKm"
      FROM provider_profiles pp
      JOIN profiles p ON p.id = pp.id
      WHERE pp.is_active = true
        AND pp.latitude IS NOT NULL
        ${categoryFilter}
        ${minRatingFilter}
        ${maxPriceFilter}
    )
    SELECT
      id, "displayName", "avatarKey", "basePrice", "priceUnit", "areaLabel",
      latitude, longitude, "isVerified", "experienceSinceYear", "ratingAvg", "ratingCount",
      "distanceKm"
    FROM candidates
    WHERE "distanceKm" <= ${params.maxKm} AND "distanceKm" <= "serviceRadiusKm"
    ORDER BY ${orderBy}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `);

  return rows.map(({ experienceSinceYear, ...row }) => ({
    ...row,
    // toFixed, not toString -- Decimal normalizes away trailing zeros
    // (e.g. "1200" instead of "1200.00").
    basePrice: row.basePrice.toFixed(2),
    ratingAvg: row.ratingAvg.toFixed(2),
    experienceYears: experienceYears(experienceSinceYear),
  }));
}

/**
 * Homepage "recommended pros": active providers, verified first, then by
 * rating. No location involved, so `distanceKm` is 0 and shouldn't be shown.
 */
export async function listFeaturedProviders(
  _actor: Actor | null,
  limit = 4,
): Promise<SearchResultDto[]> {
  const rows = await db.providerProfile.findMany({
    where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
    orderBy: [
      { isVerified: "desc" },
      { ratingAvg: "desc" },
      { ratingCount: "desc" },
      { id: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      displayName: true,
      basePrice: true,
      priceUnit: true,
      areaLabel: true,
      latitude: true,
      longitude: true,
      isVerified: true,
      experienceSinceYear: true,
      ratingAvg: true,
      ratingCount: true,
      profile: { select: { avatarKey: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    avatarKey: row.profile.avatarKey,
    basePrice: row.basePrice.toFixed(2),
    priceUnit: row.priceUnit,
    areaLabel: row.areaLabel,
    latitude: Number(row.latitude!.toFixed(3)),
    longitude: Number(row.longitude!.toFixed(3)),
    isVerified: row.isVerified,
    experienceYears: experienceYears(row.experienceSinceYear),
    ratingAvg: row.ratingAvg.toFixed(2),
    ratingCount: row.ratingCount,
    distanceKm: 0,
  }));
}
