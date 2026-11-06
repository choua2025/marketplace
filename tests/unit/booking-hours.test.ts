import { describe, expect, it } from "vitest";
import { billableHours } from "@/lib/booking-hours";

const at = (time: string) => new Date(`2026-11-06T${time}:00`);

describe("billableHours", () => {
  it("counts whole hours", () => {
    expect(billableHours(at("10:00"), at("14:00"))).toBe(4);
  });

  it("rounds a started hour up", () => {
    expect(billableHours(at("10:00"), at("13:59"))).toBe(4);
    expect(billableHours(at("10:00"), at("10:15"))).toBe(1);
  });

  it("is null for an empty or backwards range", () => {
    expect(billableHours(at("10:00"), at("10:00"))).toBeNull();
    expect(billableHours(at("14:00"), at("10:00"))).toBeNull();
    expect(billableHours(at("10:00"), new Date(Number.NaN))).toBeNull();
  });
});
