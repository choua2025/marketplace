import { describe, expect, it } from "vitest";
import { isGooglePhotoUrl } from "@/lib/google-photo";

describe("isGooglePhotoUrl", () => {
  it("accepts Google profile-picture URLs only", () => {
    expect(isGooglePhotoUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(true);
    expect(isGooglePhotoUrl("https://lh3.googleusercontent.com.evil.example/a")).toBe(false);
    expect(isGooglePhotoUrl("http://lh3.googleusercontent.com/a/abc")).toBe(false);
    expect(isGooglePhotoUrl("avatar/user-1/photo.jpg")).toBe(false);
    expect(isGooglePhotoUrl(null)).toBe(false);
  });
});
