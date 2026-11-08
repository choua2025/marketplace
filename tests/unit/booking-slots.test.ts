import { describe, expect, it } from "vitest";
import { bookableDays, endTimeOptions, zonedTimeToUtc } from "@/lib/booking-slots";

const BANGKOK = "Asia/Bangkok";
// Wednesday 4 Nov 2026, 10:00 in Bangkok (03:00 UTC).
const NOW = Date.UTC(2026, 10, 4, 3, 0);
const MON_TO_SAT = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startTime: "08:00:00",
  endTime: "18:00:00",
}));

describe("zonedTimeToUtc", () => {
  it("reads the date and time on the provider's clock", () => {
    expect(zonedTimeToUtc("2026-11-04", "10:00", BANGKOK).toISOString()).toBe(
      "2026-11-04T03:00:00.000Z",
    );
  });

  it("handles a timezone with daylight saving", () => {
    // New York is UTC-4 in summer and UTC-5 in winter.
    expect(zonedTimeToUtc("2026-07-01", "09:00", "America/New_York").toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
    expect(zonedTimeToUtc("2026-12-01", "09:00", "America/New_York").toISOString()).toBe(
      "2026-12-01T14:00:00.000Z",
    );
  });
});

describe("bookableDays", () => {
  const days = bookableDays(MON_TO_SAT, BANGKOK, NOW, 7);

  it("lists the next days in the provider's timezone", () => {
    expect(days.map((d) => d.date)).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
  });

  it("starts today no sooner than 1 hour from now", () => {
    expect(days[0]?.startTimes[0]).toBe("11:00");
    expect(days[0]?.startTimes.at(-1)).toBe("17:30");
  });

  it("offers every half hour of a full working day", () => {
    expect(days[1]?.startTimes).toHaveLength(20); // 08:00 ... 17:30
    expect(days[1]?.startTimes[0]).toBe("08:00");
  });

  it("has no times on a day off", () => {
    const sunday = days.find((d) => d.weekday === 0);
    expect(sunday?.startTimes).toEqual([]);
  });

  it("has nothing at all without working hours", () => {
    expect(bookableDays([], BANGKOK, NOW, 7).every((d) => d.startTimes.length === 0)).toBe(true);
  });
});

describe("endTimeOptions", () => {
  it("runs to the end of the working window", () => {
    const ends = endTimeOptions(MON_TO_SAT, 4, "16:00");
    expect(ends).toEqual(["16:30", "17:00", "17:30", "18:00"]);
  });

  it("stops at 12 hours", () => {
    const longDay = [{ weekday: 4, startTime: "06:00", endTime: "23:00" }];
    expect(endTimeOptions(longDay, 4, "06:00").at(-1)).toBe("18:00");
  });

  it("keeps a window end that isn't on the half hour", () => {
    const rules = [{ weekday: 4, startTime: "08:00", endTime: "17:45" }];
    expect(endTimeOptions(rules, 4, "17:00")).toEqual(["17:30", "17:45"]);
  });

  it("is empty outside working hours", () => {
    expect(endTimeOptions(MON_TO_SAT, 0, "10:00")).toEqual([]);
  });
});

describe("confirmed jobs", () => {
  // Thursday 5 Nov, 10:00-12:00 Bangkok is already booked.
  const busy = [
    {
      start: zonedTimeToUtc("2026-11-05", "10:00", BANGKOK).getTime(),
      end: zonedTimeToUtc("2026-11-05", "12:00", BANGKOK).getTime(),
    },
  ];

  it("aren't offered as start times", () => {
    const thursday = bookableDays(MON_TO_SAT, BANGKOK, NOW, 7, busy)[1];
    expect(thursday?.startTimes).not.toContain("10:00");
    expect(thursday?.startTimes).not.toContain("11:30");
    expect(thursday?.startTimes).toContain("09:30");
    expect(thursday?.startTimes).toContain("12:00");
  });

  it("cut the end times off at the next booked job", () => {
    const startAt = zonedTimeToUtc("2026-11-05", "08:00", BANGKOK).getTime();
    expect(endTimeOptions(MON_TO_SAT, 4, "08:00", { startAt, busy })).toEqual([
      "08:30",
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("don't limit a booking that starts after them", () => {
    const startAt = zonedTimeToUtc("2026-11-05", "16:00", BANGKOK).getTime();
    expect(endTimeOptions(MON_TO_SAT, 4, "16:00", { startAt, busy }).at(-1)).toBe("18:00");
  });
});
