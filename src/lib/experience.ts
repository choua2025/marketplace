/** The form asks for years (not a start year), so Buddhist-era years like 2568 can't slip in. */
export const MAX_EXPERIENCE_YEARS = 60;

/** Years in the trade, from the stored start year; null when not given. */
export function experienceYears(sinceYear: number | null, now = new Date()): number | null {
  return sinceYear === null ? null : Math.max(0, now.getFullYear() - sinceYear);
}

/** The start year to store for "N years of experience" as of today. */
export function experienceSinceYear(years: number, now = new Date()): number {
  return now.getFullYear() - years;
}
