import { db } from "@/server/db/client";
import { Prisma } from "@/server/db/generated/prisma/client";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import { dateToTimeString, timeStringToDate } from "@/server/lib/pg-time";
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

const providerProfileSelect = {
  id: true,
  displayName: true,
  bio: true,
  basePrice: true,
  priceUnit: true,
  latitude: true,
  longitude: true,
  areaLabel: true,
  serviceRadiusKm: true,
  isActive: true,
  isVerified: true,
  ratingAvg: true,
  ratingCount: true,
  completedJobs: true,
} satisfies Prisma.ProviderProfileSelect;

type ProviderProfileRow = Prisma.ProviderProfileGetPayload<{
  select: typeof providerProfileSelect;
}>;

/** basePrice/latitude/longitude/ratingAvg come back as Prisma Decimal -- the
 * rest of the app (DTOs, forms) works with the fixed-scale strings Postgres
 * returns, same as the previous Drizzle `numeric` columns did -- `toFixed`,
 * not `toString`, since Decimal normalizes away trailing zeros (e.g.
 * "1200" instead of "1200.00"). */
function toProviderProfileDto(row: ProviderProfileRow): ProviderProfileDto {
  return {
    ...row,
    basePrice: row.basePrice.toFixed(2),
    latitude: row.latitude?.toFixed(6) ?? null,
    longitude: row.longitude?.toFixed(6) ?? null,
    ratingAvg: row.ratingAvg.toFixed(2),
  };
}

export async function updateProviderProfile(
  actor: Actor | null,
  input: unknown,
): Promise<ProviderProfileDto> {
  const provider = assertProvider(actor);
  const parsed = updateProviderProfileSchema.parse(input);
  const hasLocation = parsed.latitude !== undefined;

  try {
    const updated = await db.providerProfile.update({
      where: { id: provider.id },
      data: {
        displayName: parsed.displayName,
        bio: parsed.bio ?? null,
        basePrice: parsed.basePrice.toFixed(2),
        priceUnit: parsed.priceUnit,
        areaLabel: parsed.areaLabel ?? null,
        latitude: hasLocation ? parsed.latitude?.toFixed(6) : null,
        longitude: hasLocation ? parsed.longitude?.toFixed(6) : null,
        serviceRadiusKm: parsed.serviceRadiusKm,
        isActive: parsed.isActive,
      },
      select: providerProfileSelect,
    });
    return toProviderProfileDto(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError("NOT_FOUND");
    }
    throw error;
  }
}

export async function setProviderCategories(
  actor: Actor | null,
  input: unknown,
): Promise<string[]> {
  const provider = assertProvider(actor);
  const { categorySlugs } = setProviderCategoriesSchema.parse(input);

  const matched = await db.category.findMany({
    where: { slug: { in: categorySlugs } },
    select: { id: true, slug: true },
  });

  if (matched.length !== categorySlugs.length) {
    throw new AppError("VALIDATION_ERROR", "One or more categories don't exist.");
  }

  await db.$transaction([
    db.providerCategory.deleteMany({ where: { providerId: provider.id } }),
    db.providerCategory.createMany({
      data: matched.map((c) => ({ providerId: provider.id, categoryId: c.id })),
    }),
  ]);

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

  await db.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { providerId: provider.id } });
    if (rules.length > 0) {
      await tx.availabilityRule.createMany({
        data: rules.map((r) => ({
          providerId: provider.id,
          weekday: r.weekday,
          startTime: timeStringToDate(r.startTime),
          endTime: timeStringToDate(r.endTime),
        })),
      });
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

  const profile = await db.providerProfile.findUnique({
    where: { id: provider.id },
    select: providerProfileSelect,
  });
  if (!profile) throw new AppError("NOT_FOUND");

  const ownProfile = await db.profile.findUnique({
    where: { id: provider.id },
    select: { avatarKey: true },
  });

  const categoryRows = await db.providerCategory.findMany({
    where: { providerId: provider.id },
    select: { category: { select: { slug: true } } },
  });

  const availabilityRows = await db.availabilityRule.findMany({
    where: { providerId: provider.id },
    select: { weekday: true, startTime: true, endTime: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });

  const portfolio = await db.portfolioItem.findMany({
    where: { providerId: provider.id },
    select: { id: true, imageKey: true, caption: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return {
    profile: toProviderProfileDto(profile),
    avatarKey: ownProfile?.avatarKey ?? null,
    categorySlugs: categoryRows.map((c) => c.category.slug),
    availability: availabilityRows.map((rule) => ({
      weekday: rule.weekday,
      startTime: dateToTimeString(rule.startTime),
      endTime: dateToTimeString(rule.endTime),
    })),
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
  categories: { slug: string; nameTh: string; nameEn: string; icon: string }[];
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
  const row = await db.providerProfile.findFirst({
    where: { id: providerId, isActive: true },
    select: {
      id: true,
      displayName: true,
      bio: true,
      profile: { select: { avatarKey: true } },
      basePrice: true,
      priceUnit: true,
      areaLabel: true,
      latitude: true,
      longitude: true,
      isVerified: true,
      ratingAvg: true,
      ratingCount: true,
      completedJobs: true,
    },
  });

  if (!row) throw new AppError("NOT_FOUND");

  const categoryRows = await db.providerCategory.findMany({
    where: { providerId },
    select: { category: { select: { slug: true, nameTh: true, nameEn: true, icon: true } } },
  });

  const portfolio = await db.portfolioItem.findMany({
    where: { providerId },
    select: { id: true, imageKey: true, caption: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const availabilityRows = await db.availabilityRule.findMany({
    where: { providerId },
    select: { weekday: true, startTime: true, endTime: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });

  const round3 = (value: Prisma.Decimal | null) =>
    value === null ? null : Number(value.toFixed(3));

  return {
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    avatarKey: row.profile.avatarKey,
    basePrice: row.basePrice.toFixed(2),
    priceUnit: row.priceUnit,
    areaLabel: row.areaLabel,
    latitude: round3(row.latitude),
    longitude: round3(row.longitude),
    isVerified: row.isVerified,
    ratingAvg: row.ratingAvg.toFixed(2),
    ratingCount: row.ratingCount,
    completedJobs: row.completedJobs,
    categories: categoryRows.map((c) => c.category),
    portfolio,
    availability: availabilityRows.map((rule) => ({
      weekday: rule.weekday,
      startTime: dateToTimeString(rule.startTime),
      endTime: dateToTimeString(rule.endTime),
    })),
  };
}
