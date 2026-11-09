import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { Prisma } from "@/server/db/generated/prisma/client";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";

/**
 * Fixed-window rate limits (SPEC.md section 11), counted in the rate_limits
 * table so every app process shares them and they survive restarts. Also
 * backs Better Auth's own limiter (sign-in, OTP, password reset), see
 * src/server/auth/auth.ts.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** The app's limits, per signed-in user unless noted. */
export const RATE_LIMITS = {
  /** SPEC.md section 7.8. */
  chatMessage: { max: 20, windowMs: MINUTE },
  /** On top of the 5-pending-requests cap -- stops create/cancel loops. */
  createBooking: { max: 10, windowMs: HOUR },
  /** Each status change can email the other party. */
  bookingStatus: { max: 60, windowMs: HOUR },
  startConversation: { max: 30, windowMs: HOUR },
  review: { max: 20, windowMs: HOUR },
  upload: { max: 60, windowMs: HOUR },
  favorite: { max: 120, windowMs: HOUR },
  profileUpdate: { max: 60, windowMs: HOUR },
  verification: { max: 5, windowMs: HOUR },
  /** Per IP: search is public and runs the heaviest query. */
  search: { max: 120, windowMs: MINUTE },
  /** Per phone number: SPEC.md section 11 (the per-IP limit is Better Auth's). */
  otpPerPhone: { max: 3, windowMs: 10 * MINUTE },
} as const satisfies Record<string, { max: number; windowMs: number }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Share of calls that also sweep out expired counters. */
const CLEANUP_CHANCE = 0.01;

/**
 * Counts one request against `key` and says whether it's within `max` per
 * `windowMs`. Check and increment are one statement, so concurrent requests
 * can't all slip through on a stale count.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  let row: { count: number; retryAfterMs: number } | undefined;
  try {
    [row] = await db.$queryRaw<{ count: number; retryAfterMs: number }[]>(Prisma.sql`
      INSERT INTO "rate_limits" ("key", "count", "reset_at")
      VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."reset_at" <= now() THEN 1
                       ELSE "rate_limits"."count" + 1 END,
        "reset_at" = CASE WHEN "rate_limits"."reset_at" <= now() THEN EXCLUDED."reset_at"
                          ELSE "rate_limits"."reset_at" END
      RETURNING "count",
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("reset_at" - now())) * 1000))::int AS "retryAfterMs"
    `);
  } catch (error) {
    // Fail open: a limiter hiccup shouldn't lock everyone out of the site.
    console.error("[rate-limit] check failed:", error instanceof Error ? error.message : error);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (Math.random() < CLEANUP_CHANCE) {
    db.$executeRaw`DELETE FROM "rate_limits" WHERE "reset_at" < now()`.catch(() => {});
  }

  if (!row || row.count <= max) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: row.retryAfterMs };
}

/** Throws RATE_LIMITED when `subject` (a user id or IP) is over the named limit. */
export async function enforceRateLimit(name: RateLimitName, subject: string): Promise<void> {
  const { max, windowMs } = RATE_LIMITS[name];
  const { allowed } = await checkRateLimit(`${name}:${subject}`, max, windowMs);
  if (!allowed) throw new AppError("RATE_LIMITED");
}

/**
 * The visitor's IP for per-IP limits in Server Actions. Like Better Auth,
 * trusts the first X-Forwarded-For entry -- only safe behind a proxy that
 * overwrites that header itself (README, "Nginx" under Deploy).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown"
  );
}

/** Test-only: clears every counter so tests don't leak limits into each other. */
export async function resetRateLimitsForTesting(): Promise<void> {
  if (env.NODE_ENV !== "test") {
    throw new Error("resetRateLimitsForTesting can only be used when NODE_ENV=test");
  }
  await db.rateLimit.deleteMany();
}
