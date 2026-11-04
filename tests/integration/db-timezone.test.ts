import { describe, expect, it } from "vitest";
import { testDb } from "../helpers/db";

// Prisma's pg adapter shifts timestamptz values by the session's UTC offset
// unless the session runs in UTC (see src/server/db/adapter.ts). These fail
// on a Postgres whose default zone isn't UTC if that pinning is ever lost.
describe("database timestamps", () => {
  it("reads the database clock without a time-zone shift", async () => {
    const [row] = await testDb.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    expect(Math.abs(row!.now.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("stores a JS Date as the same instant", async () => {
    const sent = new Date("2026-11-04T12:00:00.000Z");
    const [row] = await testDb.$queryRaw<{ stored: string }[]>`
      SELECT to_char(${sent}::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS stored`;
    expect(row!.stored).toBe("2026-11-04T12:00:00");
  });
});
