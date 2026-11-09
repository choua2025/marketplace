import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/auth";
import { becomeProvider } from "@/server/services/profile";
import { setSmsProviderForTesting } from "@/server/sms";
import { resetRateLimitsForTesting } from "@/server/lib/rate-limit";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";
import { RecordingSmsProvider } from "../helpers/recording-sms-provider";
import { RecordingEmailProvider } from "../helpers/recording-email-provider";
import { setEmailProviderForTesting } from "@/server/email";

let sms: RecordingSmsProvider;
let mail: RecordingEmailProvider;

beforeEach(async () => {
  await resetTestDatabase();
  await resetRateLimitsForTesting();
  sms = new RecordingSmsProvider();
  setSmsProviderForTesting(sms);
  mail = new RecordingEmailProvider();
  setEmailProviderForTesting(mail);
});

/** Follows the confirmation link from the sign-up email, as the user would. */
async function confirmEmail(email: string) {
  const link = await mail.lastLinkTo(email);
  const token = link.searchParams.get("token");
  if (!token) throw new Error("verification link has no token");
  await auth.api.verifyEmail({ query: { token } });
}

async function signUpByPhone(phoneNumber: string) {
  await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
  const code = sms.getLastCode(phoneNumber);
  return auth.api.verifyPhoneNumber({ body: { phoneNumber, code } });
}

describe("sign-up always yields role=customer", () => {
  it("creates a profiles row with role=customer after phone verification", async () => {
    const result = await signUpByPhone("+66810000001");
    const userId = result.user?.id;
    expect(userId).toBeDefined();

    const profile = await testOwnerDb.profile.findUnique({ where: { id: userId as string } });

    expect(profile?.role).toBe("customer");
  });
});

describe("OTP rate limiting (SPEC.md section 11: 3 per 10 min per phone)", () => {
  it("allows 3 OTP requests then rejects the 4th for the same phone number", async () => {
    const phoneNumber = "+66810000002";

    for (let i = 0; i < 3; i++) {
      const result = await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
      expect(result.message).toBe("code sent");
    }

    await expect(auth.api.sendPhoneNumberOTP({ body: { phoneNumber } })).rejects.toMatchObject({
      status: "TOO_MANY_REQUESTS",
    });
  });

  it("tracks the limit per phone number, not globally", async () => {
    const phoneA = "+66810000003";
    const phoneB = "+66810000004";

    for (let i = 0; i < 3; i++) {
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: phoneA } });
    }

    await expect(
      auth.api.sendPhoneNumberOTP({ body: { phoneNumber: phoneB } }),
    ).resolves.toMatchObject({ message: "code sent" });
  });
});

describe("becomeProvider", () => {
  it("upgrades a customer and creates provider_profiles", async () => {
    const result = await signUpByPhone("+66810000005");
    const userId = result.user?.id as string;

    await becomeProvider({ id: userId, role: "customer" });

    const profile = await testOwnerDb.profile.findUnique({ where: { id: userId } });
    expect(profile?.role).toBe("provider");

    const providerProfile = await testOwnerDb.providerProfile.findUnique({
      where: { id: userId },
    });
    expect(providerProfile).toBeDefined();
    expect(providerProfile?.displayName.length).toBeGreaterThanOrEqual(2);
  });

  it("is idempotent when the actor is already a provider", async () => {
    const result = await signUpByPhone("+66810000006");
    const userId = result.user?.id as string;

    await becomeProvider({ id: userId, role: "customer" });
    await expect(becomeProvider({ id: userId, role: "provider" })).resolves.toEqual({
      role: "provider",
    });
  });

  it("rejects an admin actor", async () => {
    await expect(becomeProvider({ id: "whoever", role: "admin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects an anonymous actor", async () => {
    await expect(becomeProvider(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("email+password sign-up with phone number", () => {
  function signUp(overrides: Record<string, string> = {}) {
    return auth.api.signUpEmail({
      body: {
        name: "Email User",
        email: "email-user@changdee.test",
        password: "password123",
        phoneNumber: "+66820000001",
        ...overrides,
      },
    });
  }

  it("creates a customer profile and stores the normalized phone number", async () => {
    const result = await signUp({ phoneNumber: "+66 82-000-0001" });
    const userId = result.user.id;

    const profile = await testOwnerDb.profile.findUnique({ where: { id: userId } });
    expect(profile?.role).toBe("customer");
    expect(profile?.fullName).toBe("Email User");

    const user = await testOwnerDb.user.findUnique({ where: { id: userId } });
    expect(user?.phoneNumber).toBe("+66820000001");
  });

  it("can sign in with the same email and password once the email is confirmed", async () => {
    await signUp();
    await confirmEmail("email-user@changdee.test");
    const result = await auth.api.signInEmail({
      body: { email: "email-user@changdee.test", password: "password123" },
    });
    expect(result.user.email).toBe("email-user@changdee.test");
  });

  it("rejects a wrong password", async () => {
    await signUp();
    await confirmEmail("email-user@changdee.test");
    await expect(
      auth.api.signInEmail({ body: { email: "email-user@changdee.test", password: "wrong-pass" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("requires a phone number", async () => {
    await expect(signUp({ phoneNumber: "" })).rejects.toMatchObject({
      body: { code: "PHONE_REQUIRED" },
    });
  });

  it("rejects a malformed phone number", async () => {
    await expect(signUp({ phoneNumber: "call-me" })).rejects.toMatchObject({
      body: { code: "INVALID_PHONE" },
    });
  });

  it("rejects a phone number that is already registered", async () => {
    await signUp();
    await expect(signUp({ email: "someone-else@changdee.test" })).rejects.toMatchObject({
      body: { code: "PHONE_TAKEN" },
    });
  });

  it("doesn't reveal or change an already-registered email", async () => {
    await signUp();
    // With email verification on, a duplicate sign-up looks like any other
    // (no session, no "already exists" error), so the form can't be used to
    // find out who has an account -- and the original account is untouched.
    const second = await signUp({ name: "Someone Else", phoneNumber: "+66820000002" });
    expect(second.token).toBeNull();

    const users = await testOwnerDb.user.findMany({ where: { email: "email-user@changdee.test" } });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ name: "Email User", phoneNumber: "+66820000001" });
  });
});

describe("phone-number endpoints are closed over HTTP", () => {
  function post(path: string, body: unknown) {
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    return auth.handler(
      new Request(`${base}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify(body),
      }),
    );
  }

  it.each([
    "/phone-number/send-otp",
    "/phone-number/verify",
    "/phone-number/request-password-reset",
    "/phone-number/reset-password",
    "/sign-in/phone-number",
  ])("%s returns 404 and sends no SMS", async (path) => {
    const res = await post(path, { phoneNumber: "+66830000001", code: "123456", password: "x" });
    expect(res.status).toBe(404);
    expect(() => sms.getLastCode("+66830000001")).toThrow(/No OTP was sent/);
  });

  it("still allows email sign-up over HTTP", async () => {
    const res = await post("/sign-up/email", {
      name: "Http User",
      email: "http-user@changdee.test",
      password: "password123",
      phoneNumber: "+66830000002",
    });
    expect(res.status).toBe(200);
  });
});

describe("email verification", () => {
  const body = {
    name: "Verify Me",
    email: "verify-me@changdee.test",
    password: "password123",
    phoneNumber: "+66840000001",
  };

  it("sends a confirmation email on sign-up and blocks login until it's clicked", async () => {
    const signUp = await auth.api.signUpEmail({ body });
    // No session is handed out at sign-up.
    expect(signUp.token).toBeNull();

    const link = await mail.lastLinkTo(body.email);
    expect(link.pathname).toBe("/api/auth/verify-email");

    await expect(
      auth.api.signInEmail({ body: { email: body.email, password: body.password } }),
    ).rejects.toMatchObject({ body: { code: "EMAIL_NOT_VERIFIED" } });

    await confirmEmail(body.email);
    const user = await testOwnerDb.user.findUnique({ where: { email: body.email } });
    expect(user?.emailVerified).toBe(true);

    const signIn = await auth.api.signInEmail({
      body: { email: body.email, password: body.password },
    });
    expect(signIn.user.email).toBe(body.email);
  });

  it("rejects a tampered confirmation token", async () => {
    await auth.api.signUpEmail({ body });
    await expect(
      auth.api.verifyEmail({ query: { token: "not-a-real-token" } }),
    ).rejects.toBeTruthy();
    const user = await testOwnerDb.user.findUnique({ where: { email: body.email } });
    expect(user?.emailVerified).toBe(false);
  });
});

describe("Google profile picture", () => {
  const photo = "https://lh3.googleusercontent.com/a/ACg8ocExample=s96-c";

  async function googleUser(image: string | null, avatarKey: string | null = null) {
    await testOwnerDb.user.create({
      data: { id: "g1", name: "G", email: "g1@changdee.test", emailVerified: true, image },
    });
    await testOwnerDb.profile.create({ data: { id: "g1", fullName: "G", avatarKey } });
    // A sign-in, as far as the hooks are concerned.
    await (await auth.$context).internalAdapter.createSession("g1");
    return (await testOwnerDb.profile.findUniqueOrThrow({ where: { id: "g1" } })).avatarKey;
  }

  it("becomes the avatar when signing in without an uploaded photo", async () => {
    expect(await googleUser(photo)).toBe(photo);
  });

  it("never replaces a photo the user uploaded", async () => {
    expect(await googleUser(photo, "avatar/g1/own.jpg")).toBe("avatar/g1/own.jpg");
  });

  it("ignores an image that isn't a Google profile picture", async () => {
    expect(await googleUser("https://evil.example/x.png")).toBeNull();
  });
});

describe("forgot password", () => {
  const email = "forgetful@changdee.test";

  beforeEach(async () => {
    await auth.api.signUpEmail({
      body: { name: "Forgetful", email, password: "old-password-1", phoneNumber: "+66840000002" },
    });
    await confirmEmail(email);
    mail.sent.length = 0;
  });

  async function requestReset(target: string) {
    return auth.api.requestPasswordReset({
      body: { email: target, redirectTo: "/reset-password" },
    });
  }

  /** The reset link is /api/auth/reset-password/<token>?callbackURL=... */
  async function resetToken(target: string) {
    const link = await mail.lastLinkTo(target);
    expect(link.pathname).toMatch(/^\/api\/auth\/reset-password\/[^/]+$/);
    return link.pathname.split("/").pop()!;
  }

  it("emails a one-time link that sets a new password", async () => {
    await requestReset(email);
    const token = await resetToken(email);

    await auth.api.resetPassword({ body: { token, newPassword: "new-password-2" } });

    await expect(
      auth.api.signInEmail({ body: { email, password: "old-password-1" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    const signIn = await auth.api.signInEmail({ body: { email, password: "new-password-2" } });
    expect(signIn.user.email).toBe(email);

    // The same link can't be used twice.
    await expect(
      auth.api.resetPassword({ body: { token, newPassword: "another-pass-3" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });
  });

  it("answers the same way for an unknown email and sends nothing", async () => {
    const known = await requestReset(email);
    const unknown = await requestReset("nobody-here@changdee.test");
    expect(unknown).toEqual(known);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mail.sent.filter((m) => m.to === "nobody-here@changdee.test")).toHaveLength(0);
  });

  it("sends a Google-only account a 'sign in with Google' email instead of a reset link", async () => {
    const googleEmail = "google-only@changdee.test";
    await testOwnerDb.user.create({
      data: {
        id: "google-user",
        name: "Googler",
        email: googleEmail,
        emailVerified: true,
        accounts: {
          create: { accountId: "google-sub-1", providerId: "google", updatedAt: new Date() },
        },
      },
    });

    const answer = await requestReset(googleEmail);
    expect(answer).toEqual(await requestReset(email)); // same answer as a password account

    const link = await mail.lastLinkTo(googleEmail);
    expect(link.pathname).toBe("/login");
    const message = mail.sent.find((m) => m.to === googleEmail)!;
    expect(message.text).not.toContain("/reset-password/");
    expect(message.subject).toContain("Google");
  });

  it("logs out other sessions after a reset", async () => {
    const before = await auth.api.signInEmail({ body: { email, password: "old-password-1" } });
    await requestReset(email);
    await auth.api.resetPassword({
      body: { token: await resetToken(email), newPassword: "new-password-2" },
    });
    const session = await testOwnerDb.session.findUnique({ where: { token: before.token } });
    expect(session).toBeNull();
  });
});
