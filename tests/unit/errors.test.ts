import { describe, expect, it } from "vitest";
import { AppError, translateErrorCode } from "@/server/lib/errors";

describe("AppError", () => {
  it("carries the right HTTP status per code", () => {
    expect(new AppError("BOOKING_NOT_FOUND").httpStatus).toBe(404);
    expect(new AppError("SLOT_TAKEN").httpStatus).toBe(409);
    expect(new AppError("RATE_LIMITED").httpStatus).toBe(429);
    expect(new AppError("UNAUTHORIZED").httpStatus).toBe(401);
  });

  it("defaults the message to the error code", () => {
    expect(new AppError("CONTACT_LOCKED").message).toBe("CONTACT_LOCKED");
  });
});

describe("translateErrorCode", () => {
  it("returns a Thai message", () => {
    expect(translateErrorCode("SLOT_TAKEN", "th")).toBe("ช่วงเวลานี้ถูกจองไปแล้ว");
  });

  it("returns an English message", () => {
    expect(translateErrorCode("SLOT_TAKEN", "en")).toBe("That time slot was just taken.");
  });
});
