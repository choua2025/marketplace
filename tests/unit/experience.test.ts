import { describe, expect, it } from "vitest";
import { experienceSinceYear, experienceYears } from "@/lib/experience";

describe("experience", () => {
  const now = new Date("2026-11-04T00:00:00Z");

  it("round-trips years of experience through the stored start year", () => {
    expect(experienceSinceYear(8, now)).toBe(2018);
    expect(experienceYears(2018, now)).toBe(8);
  });

  it("keeps counting up in later years", () => {
    expect(experienceYears(2018, new Date("2028-06-01T00:00:00Z"))).toBe(10);
  });

  it("returns null when not given and never goes negative", () => {
    expect(experienceYears(null, now)).toBeNull();
    expect(experienceYears(2030, now)).toBe(0);
  });
});
