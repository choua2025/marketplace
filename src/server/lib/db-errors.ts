import { DrizzleQueryError } from "drizzle-orm";

/** PostgreSQL SQLSTATE code (e.g. "23P01" for an exclusion constraint violation). */
export function getPgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof DrizzleQueryError)) return undefined;
  const cause = error.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return undefined;
  return String((cause as { code: unknown }).code);
}
