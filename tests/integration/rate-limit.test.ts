import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, enforceRateLimit, RATE_LIMITS } from "@/server/lib/rate-limit";
import { createBooking } from "@/server/services/booking";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("checkRateLimit", () => {
  it("allows up to the limit, then refuses with the time left", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit("test:a", 3, 60_000)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit("test:a", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(55_000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("counts each key separately", async () => {
    await checkRateLimit("test:a", 1, 60_000);
    expect((await checkRateLimit("test:a", 1, 60_000)).allowed).toBe(false);
    expect((await checkRateLimit("test:b", 1, 60_000)).allowed).toBe(true);
  });

  it("starts over once the window has passed", async () => {
    await checkRateLimit("test:a", 1, 100);
    expect((await checkRateLimit("test:a", 1, 100)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await checkRateLimit("test:a", 1, 100)).allowed).toBe(true);
  });

  it("lets exactly `max` through when requests arrive at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => checkRateLimit("test:burst", 5, 60_000)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("enforceRateLimit", () => {
  it("throws RATE_LIMITED past the named limit", async () => {
    const { max } = RATE_LIMITS.verification;
    for (let i = 0; i < max; i++) await enforceRateLimit("verification", "user1");
    await expect(enforceRateLimit("verification", "user1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    // Another user isn't affected.
    await expect(enforceRateLimit("verification", "user2")).resolves.toBeUndefined();
  });

  it("guards creating bookings", async () => {
    // As if this customer had already sent the hour's maximum.
    await testOwnerDb.rateLimit.create({
      data: {
        key: "createBooking:cust1",
        count: RATE_LIMITS.createBooking.max,
        resetAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(createBooking({ id: "cust1", role: "customer" }, {})).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
