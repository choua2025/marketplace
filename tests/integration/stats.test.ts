import { beforeEach, describe, expect, it } from "vitest";
import { getPublicStats } from "@/server/services/stats";
import { getMyPersonalInfo, setShowOnHomepage } from "@/server/services/profile";
import type { Actor } from "@/server/lib/actor";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

// Google photo URLs are passed through as-is, so no storage signing is needed.
const photo = (id: string) => `https://lh3.googleusercontent.com/a/${id}`;

async function createCustomer(id: string, createdAt: Date, avatarKey: string | null) {
  await testOwnerDb.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  await testOwnerDb.profile.create({
    data: { id, role: "customer", fullName: id, avatarKey, createdAt },
  });
  return { id, role: "customer" } satisfies Actor;
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("homepage customer photos", () => {
  it("shows a photo only for customers who opted in", async () => {
    const alice = await createCustomer("alice", new Date("2026-11-01"), photo("alice"));
    await createCustomer("bob", new Date("2026-11-02"), photo("bob"));
    await createCustomer("carol", new Date("2026-11-03"), null);

    expect(await getMyPersonalInfo(alice)).toMatchObject({ showOnHomepage: false });
    let stats = await getPublicStats(null);
    expect(stats.recentCustomers.every((c) => c.imageUrl === null)).toBe(true);

    await setShowOnHomepage(alice, true);
    stats = await getPublicStats(null);
    // Opted-in customers with a photo come first; the rest stay initials.
    expect(stats.recentCustomers.map((c) => [c.initial, c.imageUrl])).toEqual([
      ["A", photo("alice")],
      ["C", null],
      ["B", null],
    ]);

    await setShowOnHomepage(alice, false);
    stats = await getPublicStats(null);
    expect(stats.recentCustomers.every((c) => c.imageUrl === null)).toBe(true);
  });

  it("requires a signed-in user and a boolean", async () => {
    await expect(setShowOnHomepage(null, true)).rejects.toThrow("UNAUTHORIZED");
    const alice = await createCustomer("alice", new Date(), null);
    await expect(setShowOnHomepage(alice, "yes")).rejects.toThrow();
  });
});
