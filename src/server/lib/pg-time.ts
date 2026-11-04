/**
 * Postgres TIME columns surface through Prisma as `Date` objects anchored to
 * the 1970-01-01 epoch date, with the real value in the UTC hour/minute/
 * second fields (verified empirically -- Prisma has no "time-only" JS type).
 * The rest of the app works with plain "HH:MM:SS" strings (matching how
 * availability rules are entered, compared, and stored in validation
 * schemas), so every TIME column is converted at the Prisma boundary.
 */
export function timeStringToDate(time: string): Date {
  return new Date(`1970-01-01T${time}Z`);
}

export function dateToTimeString(date: Date): string {
  return date.toISOString().slice(11, 19);
}
