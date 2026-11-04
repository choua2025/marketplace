import { defineRouting } from "next-intl/routing";

// th is the default locale and gets no URL prefix (SPEC.md section 9/15:
// next-intl with th default + en/lo) -- every URL that existed before M8
// keeps working unchanged for Thai users; only `en`/`lo` pages get a prefix.
export const routing = defineRouting({
  locales: ["th", "en", "lo"],
  defaultLocale: "th",
  localePrefix: "as-needed",
});
