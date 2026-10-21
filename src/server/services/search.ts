import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import type { Actor } from "@/server/lib/actor";
import { searchProvidersSchema } from "@/lib/validations/search";

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
    ? sql`AND EXISTS (
        SELECT 1 FROM provider_categories pc
        JOIN categories c ON c.id = pc.category_id
        WHERE pc.provider_id = pp.id AND c.slug = ${params.categorySlug}
      )`
    : sql``;

  const minRatingFilter =
    params.minRating !== undefined ? sql`AND pp.rating_avg >= ${params.minRating}` : sql``;

  const maxPriceFilter =
    params.maxPrice !== undefined ? sql`AND pp.base_price <= ${params.maxPrice}` : sql``;

  const orderBy =
    params.sort === "distance"
      ? sql`"distanceKm" ASC`
      : params.sort === "rating"
        ? sql`"ratingAvg" DESC, "ratingCount" DESC`
        : params.sort === "price"
          ? sql`"basePrice" ASC`
          : // recommended: verified first, then weighted rating, then distance
            sql`"isVerified" DESC, (("ratingAvg"::numeric * "ratingCount" + 4.0 * 3) / ("ratingCount" + 3)) DESC, "distanceKm" ASC`;

  const result = await db.execute<SearchResultDto>(sql`
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
      latitude, longitude, "isVerified", "ratingAvg", "ratingCount", "distanceKm"
    FROM candidates
    WHERE "distanceKm" <= ${params.maxKm} AND "distanceKm" <= "serviceRadiusKm"
    ORDER BY ${orderBy}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `);

  return result.rows;
}
