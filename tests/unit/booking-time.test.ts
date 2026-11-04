import { describe, expect, it } from "vitest";
import { bookingTimeProblem } from "@/lib/validations/booking";

const NOW = Date.UTC(2026, 10, 4, 3, 0); // 4 Nov 2026 10:00 Bangkok
const HOUR = 60 * 60 * 1000;
const at = (hoursFromNow: number) => new Date(NOW + hoursFromNow * HOUR);

describe("bookingTimeProblem", () => {
  it("accepts a normal booking", () => {
    expect(bookingTimeProblem(at(24), at(26), NOW)).toBeNull();
  });

  it("flags a start in the past or under 1 hour away", () => {
    expect(bookingTimeProblem(at(-22), at(26), NOW)).toBe("startTooSoon");
    expect(bookingTimeProblem(at(0.5), at(2), NOW)).toBe("startTooSoon");
  });

  it("flags a start more than 90 days away", () => {
    expect(bookingTimeProblem(at(91 * 24), at(91 * 24 + 2), NOW)).toBe("startTooFar");
  });

  it("flags an end at or before the start", () => {
    expect(bookingTimeProblem(at(24), at(24), NOW)).toBe("endBeforeStart");
    expect(bookingTimeProblem(at(24), at(23), NOW)).toBe("endBeforeStart");
  });

  it("flags a booking longer than 12 hours (e.g. 2 days)", () => {
    expect(bookingTimeProblem(at(24), at(24 + 12), NOW)).toBeNull();
    expect(bookingTimeProblem(at(24), at(24 + 48), NOW)).toBe("tooLong");
  });
});
