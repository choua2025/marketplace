interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory, per-process (SPEC.md decisions in PLAN.md #5): fine because
// the app deploys as a single long-running container, no horizontal
// scaling in the MVP. Revisit (Postgres-backed or Redis) if that changes.
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/** Fixed-window counter. `key` should already include the limited action. */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Test-only: clears all buckets so tests don't leak state across cases. */
export function resetRateLimitsForTesting(): void {
  buckets.clear();
}
