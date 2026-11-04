import { getLocale } from "next-intl/server";
import { ZodError } from "zod";
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
    if (error instanceof AppError || error instanceof ZodError) {
      // Guaranteed to be "th" | "en" | "lo" -- routing.ts only ever configures these three.
      const locale = (await getLocale()) as Locale;
      // A ZodError's message is the raw issue list as JSON -- never show that.
      const code = error instanceof AppError ? error.code : "VALIDATION_ERROR";
      return { ok: false, error: translateErrorCode(code, locale) };
    }
    return { ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
  }
}
