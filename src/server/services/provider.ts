import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  availabilityRules,
  categories,
  portfolioItems,
  profiles,
  providerCategories,
  providerProfiles,
} from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import {
  setAvailabilityRulesSchema,
  setProviderCategoriesSchema,
  updateProviderProfileSchema,
} from "@/lib/validations/provider";

function assertProvider(actor: Actor | null): Actor {
  if (!actor) throw new AppError("UNAUTHORIZED");
  if (actor.role !== "provider") throw new AppError("FORBIDDEN");
  return actor;
}

export interface ProviderProfileDto {
  id: string;
  displayName: string;
  bio: string | null;
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
  latitude: string | null;
  longitude: string | null;
  areaLabel: string | null;
  serviceRadiusKm: number;
  isActive: boolean;
  isVerified: boolean;
  ratingAvg: string;
  ratingCount: number;
  completedJobs: number;
}

const providerProfileColumns = {
  id: providerProfiles.id,
  displayName: providerProfiles.displayName,
  bio: providerProfiles.bio,
  basePrice: providerProfiles.basePrice,
  priceUnit: providerProfiles.priceUnit,
  latitude: providerProfiles.latitude,
  longitude: providerProfiles.longitude,
  areaLabel: providerProfiles.areaLabel,
  serviceRadiusKm: providerProfiles.serviceRadiusKm,
  isActive: providerProfiles.isActive,
  isVerified: providerProfiles.isVerified,
  ratingAvg: providerProfiles.ratingAvg,
  ratingCount: providerProfiles.ratingCount,
  completedJobs: providerProfiles.completedJobs,
};

export async function updateProviderProfile(
  actor: Actor | null,
  input: unknown,
): Promise<ProviderProfileDto> {
  const provider = assertProvider(actor);
  const parsed = updateProviderProfileSchema.parse(input);
  const hasLocation = parsed.latitude !== undefined;

  const [updated] = await db
    .update(providerProfiles)
    .set({
      displayName: parsed.displayName,
      bio: parsed.bio ?? null,
      basePrice: parsed.basePrice.toFixed(2),
      priceUnit: parsed.priceUnit,
      areaLabel: parsed.areaLabel ?? null,
      latitude: hasLocation ? parsed.latitude?.toFixed(6) : null,
      longitude: hasLocation ? parsed.longitude?.toFixed(6) : null,
      serviceRadiusKm: parsed.serviceRadiusKm,
      isActive: parsed.isActive,
    })
    .where(eq(providerProfiles.id, provider.id))
    .returning(providerProfileColumns);

  if (!updated) throw new AppError("NOT_FOUND");
  return updated;
}

export async function setProviderCategories(
  actor: Actor | null,
  input: unknown,
): Promise<string[]> {
  const provider = assertProvider(actor);
  const { categorySlugs } = setProviderCategoriesSchema.parse(input);

  const matched = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(inArray(categories.slug, categorySlugs));

  if (matched.length !== categorySlugs.length) {
    throw new AppError("VALIDATION_ERROR", "One or more categories don't exist.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(providerCategories).where(eq(providerCategories.providerId, provider.id));
    await tx
      .insert(providerCategories)
      .values(matched.map((c) => ({ providerId: provider.id, categoryId: c.id })));
  });

  return matched.map((c) => c.slug);
}

export interface AvailabilityRuleDto {
  weekday: number;
  startTime: string;
  endTime: string;
}

export async function setAvailabilityRules(
  actor: Actor | null,
  input: unknown,
): Promise<AvailabilityRuleDto[]> {
  const provider = assertProvider(actor);
  const { rules } = setAvailabilityRulesSchema.parse(input);

  const seen = new Set<string>();
  for (const rule of rules) {
    const key = `${rule.weekday}-${rule.startTime}`;
    if (seen.has(key)) {
      throw new AppError("VALIDATION_ERROR", "Duplicate weekday/start time in availability rules.");
    }
    seen.add(key);
  }

  await db.transaction(async (tx) => {
    await tx.delete(availabilityRules).where(eq(availabilityRules.providerId, provider.id));
    if (rules.length > 0) {
      await tx.insert(availabilityRules).values(
        rules.map((r) => ({
          providerId: provider.id,
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      );
    }
  });

  return rules;
}

export interface PortfolioItemDto {
  id: string;
  imageKey: string;
  caption: string | null;
  sortOrder: number;
}

export interface ProviderDashboardDto {
  profile: ProviderProfileDto;
  avatarKey: string | null;
  categorySlugs: string[];
  availability: AvailabilityRuleDto[];
  portfolio: PortfolioItemDto[];
}

/** Everything the provider's own dashboard/profile-edit page needs, in one call. */
export async function getMyProviderDashboard(actor: Actor | null): Promise<ProviderDashboardDto> {
  const provider = assertProvider(actor);

  const [profile] = await db
    .select(providerProfileColumns)
    .from(providerProfiles)
    .where(eq(providerProfiles.id, provider.id));
  if (!profile) throw new AppError("NOT_FOUND");

  const [ownProfile] = await db
    .select({ avatarKey: profiles.avatarKey })
    .from(profiles)
    .where(eq(profiles.id, provider.id));

  const categoryRows = await db
    .select({ slug: categories.slug })
    .from(providerCategories)
    .innerJoin(categories, eq(providerCategories.categoryId, categories.id))
    .where(eq(providerCategories.providerId, provider.id));

  const availability = await db
    .select({
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.providerId, provider.id))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));

  const portfolio = await db
    .select({
      id: portfolioItems.id,
      imageKey: portfolioItems.imageKey,
      caption: portfolioItems.caption,
      sortOrder: portfolioItems.sortOrder,
    })
    .from(portfolioItems)
    .where(eq(portfolioItems.providerId, provider.id))
    .orderBy(asc(portfolioItems.sortOrder));

  return {
    profile,
    avatarKey: ownProfile?.avatarKey ?? null,
    categorySlugs: categoryRows.map((c) => c.slug),
    availability,
    portfolio,
  };
}

export type PublicProviderProfileDto = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarKey: string | null;
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
  areaLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
  ratingAvg: string;
  ratingCount: number;
  completedJobs: number;
  categories: { slug: string; nameTh: string; icon: string }[];
  portfolio: PortfolioItemDto[];
  availability: AvailabilityRuleDto[];
};

/**
 * Public profile (SPEC.md section 7.5): visible to everyone, no phone/
 * contact info, coordinates rounded to 3 decimals like search results --
 * showing the exact location here would make the search rounding
 * pointless since anyone could just open the profile instead.
 */
export async function getPublicProviderProfile(
  _actor: Actor | null,
  providerId: string,
): Promise<PublicProviderProfileDto> {
  const [row] = await db
    .select({
      id: providerProfiles.id,
      displayName: providerProfiles.displayName,
      bio: providerProfiles.bio,
      avatarKey: profiles.avatarKey,
      basePrice: providerProfiles.basePrice,
      priceUnit: providerProfiles.priceUnit,
      areaLabel: providerProfiles.areaLabel,
      latitude: sql<number | null>`ROUND(${providerProfiles.latitude}::numeric, 3)::float8`,
      longitude: sql<number | null>`ROUND(${providerProfiles.longitude}::numeric, 3)::float8`,
      isVerified: providerProfiles.isVerified,
      ratingAvg: providerProfiles.ratingAvg,
      ratingCount: providerProfiles.ratingCount,
      completedJobs: providerProfiles.completedJobs,
    })
    .from(providerProfiles)
    .innerJoin(profiles, eq(profiles.id, providerProfiles.id))
    .where(and(eq(providerProfiles.id, providerId), eq(providerProfiles.isActive, true)));

  if (!row) throw new AppError("NOT_FOUND");

  const categoryRows = await db
    .select({ slug: categories.slug, nameTh: categories.nameTh, icon: categories.icon })
    .from(providerCategories)
    .innerJoin(categories, eq(providerCategories.categoryId, categories.id))
    .where(eq(providerCategories.providerId, providerId));

  const portfolio = await db
    .select({
      id: portfolioItems.id,
      imageKey: portfolioItems.imageKey,
      caption: portfolioItems.caption,
      sortOrder: portfolioItems.sortOrder,
    })
    .from(portfolioItems)
    .where(eq(portfolioItems.providerId, providerId))
    .orderBy(asc(portfolioItems.sortOrder));

  const availability = await db
    .select({
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.providerId, providerId))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));

  return {
    ...row,
    categories: categoryRows,
    portfolio,
    availability,
  };
}
