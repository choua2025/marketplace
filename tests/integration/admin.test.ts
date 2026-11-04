import { beforeEach, describe, expect, it } from "vitest";
import { listCustomersForAdmin, listProvidersForAdmin, parsePage } from "@/server/services/admin";
import type { Actor } from "@/server/lib/actor";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

const ADMIN: Actor = { id: "admin1", role: "admin" };

async function createCustomer(id: string, fullName: string, email: string, phone?: string) {
  await testOwnerDb.user.create({ data: { id, name: fullName, email } });
  await testOwnerDb.profile.create({ data: { id, role: "customer", fullName } });
  if (phone) await testOwnerDb.profileContact.create({ data: { id, phone } });
}

async function createProvider(
  id: string,
  data: { displayName: string; areaLabel?: string; isActive?: boolean; isVerified?: boolean },
) {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@shop.test` } });
  await testOwnerDb.profile.create({ data: { id, role: "provider", fullName: `Owner ${id}` } });
  await testOwnerDb.providerProfile.create({
    data: {
      id,
      displayName: data.displayName,
      areaLabel: data.areaLabel ?? null,
      // An active provider must have a location (DB check constraint).
      isActive: data.isActive ?? false,
      latitude: data.isActive ? 13.75 : null,
      longitude: data.isActive ? 100.5 : null,
      isVerified: data.isVerified ?? false,
    },
  });
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("listCustomersForAdmin", () => {
  beforeEach(async () => {
    await createCustomer("c1", "สมหญิง ใจดี", "somying@example.com", "+66811111111");
    await createCustomer("c2", "John Smith", "john@example.com");
    await createProvider("p1", { displayName: "Not a customer" });
  });

  it("lists only customers", async () => {
    const { items: rows } = await listCustomersForAdmin(ADMIN);
    expect(rows.map((r) => r.id).sort()).toEqual(["c1", "c2"]);
  });

  it("searches by name (Thai), email (case-insensitive) and phone", async () => {
    expect((await listCustomersForAdmin(ADMIN, { q: "ใจดี" })).items.map((r) => r.id)).toEqual([
      "c1",
    ]);
    expect((await listCustomersForAdmin(ADMIN, { q: "JOHN@" })).items.map((r) => r.id)).toEqual([
      "c2",
    ]);
    // Local format with dashes still finds the stored +66 number.
    const { items: byPhone } = await listCustomersForAdmin(ADMIN, { q: "081-111-1111" });
    expect(byPhone.map((r) => r.id)).toEqual(["c1"]);
    expect(byPhone[0]?.phone).toBe("+66811111111");
    expect(
      (await listCustomersForAdmin(ADMIN, { q: "+66811111111" })).items.map((r) => r.id),
    ).toEqual(["c1"]);
  });

  it("treats a blank query as no filter", async () => {
    expect((await listCustomersForAdmin(ADMIN, { q: "   " })).total).toBe(2);
  });

  it("is admin-only", async () => {
    await expect(listCustomersForAdmin({ id: "c1", role: "customer" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listCustomersForAdmin(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("listProvidersForAdmin", () => {
  beforeEach(async () => {
    await createProvider("p1", {
      displayName: "Cool Air Service",
      areaLabel: "Lat Phrao",
      isActive: true,
      isVerified: true,
    });
    await createProvider("p2", { displayName: "ประปาด่วน", areaLabel: "Bang Na" });
    await testOwnerDb.providerVerification.create({
      data: { providerId: "p2", status: "pending", documentKeys: ["verification/p2/a.jpg"] },
    });
  });

  it("searches by business name, area, owner name and email", async () => {
    const ids = async (q: string) =>
      (await listProvidersForAdmin(ADMIN, { q })).items.map((r) => r.id);
    expect(await ids("cool air")).toEqual(["p1"]);
    expect(await ids("ประปา")).toEqual(["p2"]);
    expect(await ids("bang na")).toEqual(["p2"]);
    expect(await ids("owner p1")).toEqual(["p1"]);
    expect(await ids("p2@shop")).toEqual(["p2"]);
  });

  it("filters by status", async () => {
    const ids = async (filter: "pending" | "verified" | "inactive") =>
      (await listProvidersForAdmin(ADMIN, { filter })).items.map((r) => r.id);
    expect(await ids("pending")).toEqual(["p2"]);
    expect(await ids("verified")).toEqual(["p1"]);
    expect(await ids("inactive")).toEqual(["p2"]);
  });

  it("combines search with a filter", async () => {
    expect(await listProvidersForAdmin(ADMIN, { q: "cool", filter: "pending" })).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
  });

  it("returns owner, email and verification status", async () => {
    const {
      items: [p2],
    } = await listProvidersForAdmin(ADMIN, { q: "ประปา" });
    expect(p2).toMatchObject({
      ownerName: "Owner p2",
      email: "p2@shop.test",
      verificationStatus: "pending",
      isActive: false,
    });
  });
});

describe("pagination", () => {
  beforeEach(async () => {
    // 25 customers with distinct, increasing sign-up times: c01 oldest, c25 newest.
    for (let i = 1; i <= 25; i++) {
      const id = `c${String(i).padStart(2, "0")}`;
      await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@example.com` } });
      await testOwnerDb.profile.create({
        data: { id, role: "customer", fullName: id, createdAt: new Date(2026, 0, i) },
      });
    }
  });

  it("splits results into pages, newest first, with totals", async () => {
    const page1 = await listCustomersForAdmin(ADMIN, { page: 1, pageSize: 10 });
    const page3 = await listCustomersForAdmin(ADMIN, { page: 3, pageSize: 10 });
    expect(page1).toMatchObject({ total: 25, page: 1, pageSize: 10, totalPages: 3 });
    expect(page1.items.map((c) => c.id)).toEqual([
      "c25",
      "c24",
      "c23",
      "c22",
      "c21",
      "c20",
      "c19",
      "c18",
      "c17",
      "c16",
    ]);
    expect(page3.items.map((c) => c.id)).toEqual(["c05", "c04", "c03", "c02", "c01"]);
  });

  it("covers every row exactly once across pages", async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      seen.push(
        ...(await listCustomersForAdmin(ADMIN, { page, pageSize: 10 })).items.map((c) => c.id),
      );
    }
    expect(new Set(seen).size).toBe(25);
    expect(seen).toHaveLength(25);
  });

  it("clamps a page past the end to the last page", async () => {
    const result = await listCustomersForAdmin(ADMIN, { page: 99, pageSize: 10 });
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(5);
  });

  it("paginates search results by the filtered total", async () => {
    const result = await listCustomersForAdmin(ADMIN, { q: "c1", pageSize: 5 });
    // c10..c19 match "c1".
    expect(result).toMatchObject({ total: 10, totalPages: 2 });
  });

  it("defaults to 20 per page", async () => {
    const result = await listCustomersForAdmin(ADMIN);
    expect(result).toMatchObject({ pageSize: 20, totalPages: 2 });
    expect(result.items).toHaveLength(20);
  });
});

describe("parsePage", () => {
  it("accepts positive integers and falls back to 1 otherwise", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});
