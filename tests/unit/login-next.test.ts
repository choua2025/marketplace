import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/login-next";

describe("safeNextPath", () => {
  it("keeps paths inside the site", () => {
    expect(safeNextPath("/bookings/abc")).toBe("/bookings/abc");
    expect(safeNextPath("/messages/abc?x=1")).toBe("/messages/abc?x=1");
  });

  it("drops anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "bookings",
      "",
      undefined,
      ["/bookings"],
    ]) {
      expect(safeNextPath(value)).toBeNull();
    }
  });
});
