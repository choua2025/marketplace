import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Uses the `requestLocale` param (not `next/root-params`) deliberately:
// root-params throws when called from a Server Action's context (e.g. via
// getLocale() inside toActionResult), which every Server Action in this
// app goes through to translate AppError codes -- see src/server/actions/result.ts.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
