import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { env } from "@/server/lib/env";
import { getSmsProvider } from "@/server/sms";
import { checkRateLimit } from "@/server/lib/rate-limit";

const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

function tempEmailForPhoneSignUp(phoneNumber: string): string {
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, "");
  return `phone-${digitsOnly}@changdee.local`;
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // SPEC.md section 13: email+password sign-in is a dev-only convenience
  // for the seeded test accounts. Treated as "not production" (not a
  // literal NODE_ENV===development check) so it's still exercisable in
  // CI's NODE_ENV=test integration tests.
  emailAndPassword: {
    enabled: env.NODE_ENV !== "production",
  },
  // SPEC.md section 7.1: every signup path (phone, Google, dev email)
  // lands here and gets a `profiles` row with role="customer" (the column
  // default) -- never anything a client could influence. Upgrading to
  // provider only ever happens through the audited
  // src/server/services/profile.ts#becomeProvider function.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db
            .insert(profiles)
            .values({ id: user.id, fullName: user.name })
            .onConflictDoNothing();
        },
      },
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  rateLimit: {
    enabled: true,
    customRules: {
      // SPEC.md section 11: 10 OTP requests/hour/IP (Better Auth's
      // built-in limiter is IP-keyed). The 3/10min/phone-number rule is
      // enforced separately below, inside sendOTP, since that's the only
      // hook that knows the target phone number.
      "/phone-number/send-otp": { window: 60 * 60, max: 10 },
    },
  },
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        const { allowed, retryAfterMs } = checkRateLimit(`otp:${phoneNumber}`, 3, 10 * 60 * 1000);
        if (!allowed) {
          throw APIError.fromStatus("TOO_MANY_REQUESTS", {
            message: `Too many OTP requests for this phone number. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
          });
        }
        await getSmsProvider().sendOtp(phoneNumber, code);
      },
      signUpOnVerification: {
        getTempEmail: tempEmailForPhoneSignUp,
      },
    }),
    // Must be last: lets Server Actions set the session cookie, not just
    // Route Handlers. Cookies default to httpOnly/secure/sameSite=lax
    // (SPEC.md section 11).
    nextCookies(),
  ],
});
