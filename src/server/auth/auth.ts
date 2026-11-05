import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { db } from "@/server/db/client";
import { env } from "@/server/lib/env";
import { getSmsProvider } from "@/server/sms";
import { sendAuthEmail, type Locale } from "@/server/email/auth-emails";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { normalizePhone, PHONE_PATTERN } from "@/lib/validations/profile";
import { isGooglePhotoUrl } from "@/lib/google-photo";

const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

function badRequest(code: string, message: string): APIError {
  return APIError.fromStatus("BAD_REQUEST", { code, message });
}

function tempEmailForPhoneSignUp(phoneNumber: string): string {
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, "");
  return `phone-${digitsOnly}@changdee.local`;
}

function loginUrl(locale: Locale): string {
  return `${env.APP_URL}${locale === "th" ? "" : `/${locale}`}/login`;
}

/**
 * Accounts made with "Continue with Google" have no password. Following a
 * reset link would quietly add one, so they get a "sign in with Google"
 * email (linking to the login page) instead of a reset link. The page the
 * user sees is the same either way.
 */
async function sendPasswordResetEmail(
  user: { id: string; email: string; name: string },
  resetUrl: string,
  request?: Request,
): Promise<void> {
  try {
    const hasPassword =
      (await db.account.count({ where: { userId: user.id, providerId: "credential" } })) > 0;
    if (hasPassword) {
      sendAuthEmail("resetPassword", user, resetUrl, request);
    } else {
      sendAuthEmail("useGoogle", user, loginUrl, request);
    }
  } catch (error) {
    console.error(
      "[email] resetPassword email failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  // Generated app-side rather than generateId: "uuid", which on Postgres
  // omits `id` from inserts and depends on the column default.
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  // Primary sign-up/sign-in method: name + email + password + phone number.
  // The email must be confirmed before the first login, so nobody can sign
  // up with someone else's address.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset logs out every other session, in case someone else got in.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }, request) => {
      // Not awaited, like sendAuthEmail: the extra lookup mustn't slow the answer.
      void sendPasswordResetEmail(user, url, request);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 60 * 60,
    sendVerificationEmail: async ({ user, url }, request) => {
      sendAuthEmail("verifyEmail", user, url, request);
    },
  },
  // Phone OTP / phone+password login isn't offered anywhere in the UI, so its
  // endpoints are closed over HTTP (404) -- otherwise anyone could create
  // accounts or trigger paid SMS through them. The phoneNumber plugin stays
  // because it defines the user.phoneNumber field that email sign-up uses.
  disabledPaths: [
    "/phone-number/send-otp",
    "/phone-number/verify",
    "/phone-number/request-password-reset",
    "/phone-number/reset-password",
    "/sign-in/phone-number",
  ],
  // SPEC.md section 7.1: every signup path (phone, Google, dev email)
  // lands here and gets a `profiles` row with role="customer" (the column
  // default) -- never anything a client could influence. Upgrading to
  // provider only ever happens through the audited
  // src/server/services/profile.ts#becomeProvider function.
  databaseHooks: {
    user: {
      create: {
        // Email sign-up must carry a valid, unused phone number. Google
        // sign-up has none, and phone-OTP sign-up already supplies one.
        before: async (user, ctx) => {
          const raw = typeof user.phoneNumber === "string" ? user.phoneNumber : "";
          if (!raw) {
            if (ctx?.path === "/sign-up/email") {
              throw badRequest("PHONE_REQUIRED", "Phone number is required.");
            }
            return;
          }
          const phoneNumber = normalizePhone(raw);
          if (!PHONE_PATTERN.test(phoneNumber)) {
            throw badRequest("INVALID_PHONE", "Invalid phone number format.");
          }
          const taken = await db.user.findUnique({ where: { phoneNumber }, select: { id: true } });
          if (taken) {
            throw badRequest("PHONE_TAKEN", "This phone number is already registered.");
          }
          return { data: { ...user, phoneNumber } };
        },
        after: async (user) => {
          await db.profile.upsert({
            where: { id: user.id },
            create: { id: user.id, fullName: user.name },
            update: {},
          });
        },
      },
      // Mirrors name changes (`authClient.updateUser({ name })`) onto
      // `profiles`, the table the rest of the app reads display names from.
      update: {
        after: async (user) => {
          if (!user.name) return;
          await db.profile.update({ where: { id: user.id }, data: { fullName: user.name } });
        },
      },
    },
    session: {
      create: {
        // Google sign-ins: show the Google profile picture until the user
        // uploads their own. Done at every sign-in (not just sign-up) so
        // accounts created before this existed get it too.
        after: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { image: true },
          });
          const image = user?.image;
          if (!image || !isGooglePhotoUrl(image)) return;
          await db.profile.updateMany({
            where: { id: session.userId, avatarKey: null },
            data: { avatarKey: image },
          });
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
      // Each of these sends an email -- keep them from being used to spam inboxes.
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
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
