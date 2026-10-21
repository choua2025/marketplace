import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { searchProviders } from "@/server/services/search";
import { getPublicProviderProfile } from "@/server/services/provider";
import {
  categories,
  profiles,
  providerCategories,
  providerProfiles,
  user,
} from "@/server/db/schema";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

const BANGKOK = { lat: 13.7563, lng: 100.5018 };

interface ProviderFixtureOptions {
  lat?: number;
  lng?: number;
  serviceRadiusKm?: number;
  isActive?: boolean;
  isVerified?: boolean;
  ratingAvg?: string;
  ratingCount?: number;
  basePrice?: string;
  categorySlug?: string;
}

async function createProviderFixture(id: string, options: ProviderFixtureOptions = {}) {
  const {
    lat = BANGKOK.lat,
    lng = BANGKOK.lng,
    serviceRadiusKm = 25,
    isActive = true,
    isVerified = false,
    ratingAvg = "0",
    ratingCount = 0,
    basePrice = "100.00",
    categorySlug,
  } = options;

  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "provider", fullName: id });
  await testOwnerDb.insert(providerProfiles).values({
    id,
    displayName: id,
    isActive,
    isVerified,
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
    serviceRadiusKm,
    ratingAvg,
    ratingCount,
    basePrice,
  });

  if (categorySlug) {
    const [category] = await testOwnerDb
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, categorySlug));
    if (category) {
      await testOwnerDb
        .insert(providerCategories)
        .values({ providerId: id, categoryId: category.id });
    }
  }
}

async function createCustomerFixture(id: string) {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "customer", fullName: id });
}

beforeEach(async () => {
  await resetTestDatabase();
  await testOwnerDb.insert(categories).values([
    { slug: "electrician", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", icon: "zap" },
    { slug: "plumber", nameTh: "ช่างประปา", nameEn: "Plumber", icon: "wrench" },
  ]);
});

describe("searchProviders", () => {
  it("works for an anonymous actor and returns active providers near the point", async () => {
    await createProviderFixture("prov1");
    const results = await searchProviders(null, { ...BANGKOK, maxKm: 25 });
    expect(results.map((r) => r.id)).toContain("prov1");
  });

  it("filters by category", async () => {
    await createProviderFixture("prov-electrician", { categorySlug: "electrician" });
    await createProviderFixture("prov-plumber", { categorySlug: "plumber" });

    const results = await searchProviders(null, {
      ...BANGKOK,
      maxKm: 25,
      categorySlug: "electrician",
    });

    expect(results.map((r) => r.id)).toEqual(["prov-electrician"]);
  });

  it("never returns a customer profile", async () => {
    await createProviderFixture("prov1");
    await createCustomerFixture("cust1");

    const results = await searchProviders(null, { ...BANGKOK, maxKm: 200 });

    expect(results.map((r) => r.id)).not.toContain("cust1");
  });

  it("excludes inactive providers", async () => {
    await createProviderFixture("prov-active", { isActive: true });
    await createProviderFixture("prov-inactive", { isActive: false });

    const results = await searchProviders(null, { ...BANGKOK, maxKm: 200 });

    expect(results.map((r) => r.id)).toEqual(["prov-active"]);
  });

  it("excludes a provider whose service radius is smaller than the distance", async () => {
    // ~15km north of the search point
    await createProviderFixture("prov-far", { lat: BANGKOK.lat + 0.135, serviceRadiusKm: 5 });

    const results = await searchProviders(null, { ...BANGKOK, maxKm: 200 });

    expect(results.map((r) => r.id)).not.toContain("prov-far");
  });

  it("excludes providers beyond maxKm even if their own radius would allow it", async () => {
    await createProviderFixture("prov-far", { lat: BANGKOK.lat + 0.9, serviceRadiusKm: 200 });

    const results = await searchProviders(null, { ...BANGKOK, maxKm: 10 });

    expect(results.map((r) => r.id)).not.toContain("prov-far");
  });

  it("rounds returned coordinates to 3 decimal places", async () => {
    await createProviderFixture("prov1", {
      lat: 13.123456789,
      lng: 100.987654321,
      serviceRadiusKm: 200,
    });

    const [result] = await searchProviders(null, { ...BANGKOK, maxKm: 200 });

    expect(result?.latitude).toBe(13.123);
    expect(result?.longitude).toBe(100.988);
  });

  it("sorts by price ascending when sort=price", async () => {
    await createProviderFixture("prov-cheap", { basePrice: "50.00" });
    await createProviderFixture("prov-expensive", { basePrice: "500.00" });

    const results = await searchProviders(null, { ...BANGKOK, maxKm: 200, sort: "price" });

    expect(results.map((r) => r.id)).toEqual(["prov-cheap", "prov-expensive"]);
  });

  it("sorts by rating descending when sort=rating", async () => {
    await createProviderFixture("prov-low", { ratingAvg: "3.00", ratingCount: 10 });
    await createProviderFixture("prov-high", { ratingAvg: "4.80", ratingCount: 10 });

    const results = await searchProviders(null, { ...BANGKOK, maxKm: 200, sort: "rating" });

    expect(results.map((r) => r.id)).toEqual(["prov-high", "prov-low"]);
  });
});

describe("getPublicProviderProfile", () => {
  it("returns NOT_FOUND for a customer id", async () => {
    await createCustomerFixture("cust1");
    await expect(getPublicProviderProfile(null, "cust1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns NOT_FOUND for an inactive provider", async () => {
    await createProviderFixture("prov1", { isActive: false });
    await expect(getPublicProviderProfile(null, "prov1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns NOT_FOUND for a nonexistent id", async () => {
    await expect(getPublicProviderProfile(null, "does-not-exist")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns rounded coordinates and categories for an active provider", async () => {
    await createProviderFixture("prov1", {
      lat: 13.123456789,
      lng: 100.987654321,
      categorySlug: "electrician",
    });

    const profile = await getPublicProviderProfile(null, "prov1");

    expect(profile.latitude).toBe(13.123);
    expect(profile.longitude).toBe(100.988);
    expect(profile.categories).toEqual([{ slug: "electrician", nameTh: "ช่างไฟฟ้า", icon: "zap" }]);
  });
});
