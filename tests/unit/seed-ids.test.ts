import { describe, expect, it } from "vitest";
import { SEED_IDS, seedUuid } from "@/server/db/seed-ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("seedUuid", () => {
  it("produces valid version-5 UUIDs", () => {
    expect(SEED_IDS.admin).toMatch(UUID);
    expect(SEED_IDS.customer(1)).toMatch(UUID);
    expect(SEED_IDS.provider(5)).toMatch(UUID);
    expect(seedUuid("booking:x:0")).toMatch(UUID);
  });

  it("is stable, so re-seeding hits the same rows", () => {
    expect(SEED_IDS.provider(1)).toBe(SEED_IDS.provider(1));
  });

  it("gives every seeded user a different id", () => {
    const ids = [
      SEED_IDS.admin,
      ...[1, 2, 3, 4, 5].map(SEED_IDS.customer),
      ...[1, 2, 3, 4, 5].map(SEED_IDS.provider),
    ];
    expect(new Set(ids).size).toBe(11);
  });
});
