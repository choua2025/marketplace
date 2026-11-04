import { describe, expect, it } from "vitest";
import { buildAuthEmail, localeFromRequest } from "@/server/email/auth-emails";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost/api/auth/x", { headers });

describe("localeFromRequest", () => {
  it("uses the language of the page the request came from", () => {
    expect(localeFromRequest(req({ referer: "http://localhost/en/forgot-password" }))).toBe("en");
    expect(localeFromRequest(req({ referer: "http://localhost/lo/register" }))).toBe("lo");
    expect(localeFromRequest(req({ referer: "http://localhost/register" }))).toBe("th");
  });

  it("falls back to the next-intl cookie, then Thai", () => {
    expect(localeFromRequest(req({ cookie: "a=1; NEXT_LOCALE=en" }))).toBe("en");
    expect(localeFromRequest(req({}))).toBe("th");
    expect(localeFromRequest(undefined)).toBe("th");
  });
});

describe("buildAuthEmail", () => {
  const url = "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fwelcome";

  it("writes the email in the requested language with the link in text and HTML", () => {
    const en = buildAuthEmail("verifyEmail", { to: "a@b.test", name: "Ann", url, locale: "en" });
    expect(en.subject).toBe("Confirm your email - ChangDee");
    expect(en.text).toContain(url);
    expect(en.html).toContain(url.replace(/&/g, "&amp;"));

    const th = buildAuthEmail("resetPassword", { to: "a@b.test", name: "แอน", url, locale: "th" });
    expect(th.subject).toContain("ตั้งรหัสผ่านใหม่");
    expect(th.text).toContain("สวัสดีคุณ แอน");
  });

  it("escapes HTML in the user's name", () => {
    const email = buildAuthEmail("verifyEmail", {
      to: "a@b.test",
      name: '<img src=x onerror="alert(1)">',
      url,
      locale: "en",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x");
  });
});
