const HOUR_MS = 60 * 60 * 1000;

/**
 * Hours to charge for an hourly job: every started hour counts, so
 * 10:00–13:59 and 10:00–14:00 are both 4 hours. Null for an empty or
 * backwards range.
 */
export function billableHours(start: Date, end: Date): number | null {
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil(ms / HOUR_MS);
}
