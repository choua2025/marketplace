import { describe, expect, it } from "vitest";
import { hueFromString, nameInitial } from "@/lib/avatar-initial";

describe("nameInitial", () => {
  it("uses the first letter, uppercased for Latin names", () => {
    expect(nameInitial("john smith")).toBe("J");
    expect(nameInitial("  Anna ")).toBe("A");
  });

  it("uses the first consonant for Thai/Lao names that start with a leading vowel", () => {
    expect(nameInitial("สมหญิง ใจดี")).toBe("ส");
    expect(nameInitial("เอก ทดสอบ")).toBe("อ");
    expect(nameInitial("ไพโรจน์")).toBe("พ");
    expect(nameInitial("ໄຊຍະວົງ")).toBe("ຊ");
  });

  it("falls back to ? for an empty name", () => {
    expect(nameInitial("   ")).toBe("?");
  });
});

describe("hueFromString", () => {
  it("is stable and stays in 0-359", () => {
    expect(hueFromString("seed_customer_1")).toBe(hueFromString("seed_customer_1"));
    for (const id of ["a", "seed_customer_1", "seed_customer_2", "x".repeat(200)]) {
      const hue = hueFromString(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("spreads ids that differ by one character", () => {
    expect(hueFromString("seed_customer_1")).not.toBe(hueFromString("seed_customer_2"));
  });
});
