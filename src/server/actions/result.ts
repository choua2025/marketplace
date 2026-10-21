import { getLocale } from "next-intl/server";
import { AppError, translateErrorCode, type Locale } from "@/server/lib/errors";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a service call so Server Actions never throw across the
 * client/server boundary. `AppError`s are translated into the current
 * request's locale so the UI never has to show a bare error code.
 */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      // Guaranteed to be "th" | "en" -- routing.ts only ever configures these two.
      const locale = (await getLocale()) as Locale;
      return { ok: false, error: translateErrorCode(error.code, locale) };
    }
    return { ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
  }
}
