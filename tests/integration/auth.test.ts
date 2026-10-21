import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth/auth";
import { becomeProvider } from "@/server/services/profile";
import { setSmsProviderForTesting } from "@/server/sms";
import { resetRateLimitsForTesting } from "@/server/lib/rate-limit";
import { profiles, providerProfiles } from "@/server/db/schema";
import { resetTestDatabase, testOwnerDb } from "../helpers/db";
import { RecordingSmsProvider } from "../helpers/recording-sms-provider";

let sms: RecordingSmsProvider;

beforeEach(async () => {
  await resetTestDatabase();
  resetRateLimitsForTesting();
  sms = new RecordingSmsProvider();
  setSmsProviderForTesting(sms);
});

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

    const [profile] = await testOwnerDb
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId as string));

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

    const [profile] = await testOwnerDb.select().from(profiles).where(eq(profiles.id, userId));
    expect(profile?.role).toBe("provider");

    const [providerProfile] = await testOwnerDb
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, userId));
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

describe("dev email+password login", () => {
  it("creates a profiles row with role=customer for a brand-new email sign-up", async () => {
    const result = await auth.api.signUpEmail({
      body: { email: "new-dev-user@changdee.test", password: "password123", name: "Dev User" },
    });
    const userId = result.user.id;

    const [profile] = await testOwnerDb.select().from(profiles).where(eq(profiles.id, userId));
    expect(profile?.role).toBe("customer");
  });
});
