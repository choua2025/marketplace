import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import {
  addPortfolioItem,
  confirmAvatarUpload,
  createUploadUrl,
  removePortfolioItem,
} from "@/server/services/upload";
import {
  getMyProviderDashboard,
  setAvailabilityRules,
  setProviderCategories,
  updateProviderProfile,
} from "@/server/services/provider";
import { categories, portfolioItems, profiles, providerProfiles, user } from "@/server/db/schema";
import type { Actor } from "@/server/lib/actor";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

async function createProviderFixture(id: string): Promise<Actor> {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "provider", fullName: id });
  await testOwnerDb.insert(providerProfiles).values({ id, displayName: id, isActive: false });
  return { id, role: "provider" };
}

async function createCustomerFixture(id: string): Promise<Actor> {
  await testOwnerDb.insert(user).values({ id, name: id, email: `${id}@test.local` });
  await testOwnerDb.insert(profiles).values({ id, role: "customer", fullName: id });
  return { id, role: "customer" };
}

beforeEach(async () => {
  await resetTestDatabase();
  await testOwnerDb
    .insert(categories)
    .values([{ slug: "electrician", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", icon: "zap" }]);
});

describe("createUploadUrl", () => {
  it("generates a key prefixed with purpose/actorId", async () => {
    const provider = await createProviderFixture("prov1");
    const { key, uploadUrl } = await createUploadUrl(provider, {
      purpose: "avatar",
      contentType: "image/png",
      contentLength: 1024,
    });
    expect(key.startsWith(`avatar/${provider.id}/`)).toBe(true);
    expect(uploadUrl).toContain("http");
  });

  it("rejects a disallowed content type", async () => {
    const provider = await createProviderFixture("prov1");
    await expect(
      createUploadUrl(provider, {
        purpose: "avatar",
        contentType: "application/pdf",
        contentLength: 1024,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects an avatar over the 2MB limit", async () => {
    const provider = await createProviderFixture("prov1");
    await expect(
      createUploadUrl(provider, {
        purpose: "avatar",
        contentType: "image/png",
        contentLength: 3 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects a portfolio upload request from a customer", async () => {
    const customer = await createCustomerFixture("cust1");
    await expect(
      createUploadUrl(customer, {
        purpose: "portfolio",
        contentType: "image/png",
        contentLength: 1024,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("confirmAvatarUpload / addPortfolioItem key-prefix enforcement", () => {
  it("rejects confirming an avatar key that belongs to another user", async () => {
    const provider = await createProviderFixture("prov1");
    await createProviderFixture("prov2");

    await expect(confirmAvatarUpload(provider, "avatar/prov2/some-uuid.png")).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("accepts confirming an avatar key that belongs to the actor", async () => {
    const provider = await createProviderFixture("prov1");
    const key = "avatar/prov1/some-uuid.png";

    await confirmAvatarUpload(provider, key);

    const [row] = await testOwnerDb.select().from(profiles).where(eq(profiles.id, "prov1"));
    expect(row?.avatarKey).toBe(key);
  });

  it("rejects adding a portfolio item with another user's key prefix", async () => {
    const provider = await createProviderFixture("prov1");
    await createProviderFixture("prov2");

    await expect(addPortfolioItem(provider, "portfolio/prov2/some-uuid.png")).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("enforces the 30-item portfolio cap", async () => {
    const provider = await createProviderFixture("prov1");

    for (let i = 0; i < 30; i++) {
      await addPortfolioItem(provider, `portfolio/prov1/item-${i}.png`);
    }

    await expect(addPortfolioItem(provider, "portfolio/prov1/item-30.png")).rejects.toMatchObject({
      code: "PORTFOLIO_FULL",
    });
  });
});

describe("removePortfolioItem", () => {
  it("lets the owner delete their own item", async () => {
    const provider = await createProviderFixture("prov1");
    const item = await addPortfolioItem(provider, "portfolio/prov1/item-0.png");

    await removePortfolioItem(provider, item.id);

    const rows = await testOwnerDb
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.id, item.id));
    expect(rows).toHaveLength(0);
  });

  it("does not let another provider delete someone else's item", async () => {
    const owner = await createProviderFixture("prov1");
    const intruder = await createProviderFixture("prov2");
    const item = await addPortfolioItem(owner, "portfolio/prov1/item-0.png");

    await expect(removePortfolioItem(intruder, item.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("updateProviderProfile", () => {
  it("rejects a non-provider actor", async () => {
    const customer = await createCustomerFixture("cust1");
    await expect(
      updateProviderProfile(customer, {
        displayName: "Shop",
        basePrice: 100,
        priceUnit: "job",
        serviceRadiusKm: 10,
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an anonymous actor", async () => {
    await expect(
      updateProviderProfile(null, {
        displayName: "Shop",
        basePrice: 100,
        priceUnit: "job",
        serviceRadiusKm: 10,
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects going active without a location", async () => {
    const provider = await createProviderFixture("prov1");
    await expect(
      updateProviderProfile(provider, {
        displayName: "Shop",
        basePrice: 100,
        priceUnit: "job",
        serviceRadiusKm: 10,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("updates the profile when given a valid location and isActive=true", async () => {
    const provider = await createProviderFixture("prov1");
    const updated = await updateProviderProfile(provider, {
      displayName: "Shop",
      basePrice: 100,
      priceUnit: "job",
      serviceRadiusKm: 10,
      isActive: true,
      latitude: 13.75,
      longitude: 100.5,
    });
    expect(updated.isActive).toBe(true);
    expect(updated.latitude).toBe("13.750000");
  });
});

describe("setProviderCategories", () => {
  it("rejects an unknown category slug", async () => {
    const provider = await createProviderFixture("prov1");
    await expect(
      setProviderCategories(provider, { categorySlugs: ["not-a-real-category"] }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("replaces the provider's categories", async () => {
    const provider = await createProviderFixture("prov1");
    const result = await setProviderCategories(provider, { categorySlugs: ["electrician"] });
    expect(result).toEqual(["electrician"]);
  });
});

describe("setAvailabilityRules", () => {
  it("rejects duplicate weekday/startTime pairs in the same request", async () => {
    const provider = await createProviderFixture("prov1");
    await expect(
      setAvailabilityRules(provider, {
        rules: [
          { weekday: 1, startTime: "08:00", endTime: "12:00" },
          { weekday: 1, startTime: "08:00", endTime: "18:00" },
        ],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("replaces the provider's availability", async () => {
    const provider = await createProviderFixture("prov1");
    const result = await setAvailabilityRules(provider, {
      rules: [{ weekday: 1, startTime: "08:00", endTime: "18:00" }],
    });
    expect(result).toHaveLength(1);
  });
});

describe("getMyProviderDashboard", () => {
  it("returns the combined profile/categories/availability/portfolio view", async () => {
    const provider = await createProviderFixture("prov1");
    await setProviderCategories(provider, { categorySlugs: ["electrician"] });
    await addPortfolioItem(provider, "portfolio/prov1/item-0.png");

    const dashboard = await getMyProviderDashboard(provider);

    expect(dashboard.profile.id).toBe("prov1");
    expect(dashboard.categorySlugs).toEqual(["electrician"]);
    expect(dashboard.portfolio).toHaveLength(1);
  });
});
