"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABEL: Record<string, string> = {
  th: "ไทย",
  en: "English",
  lo: "ລາວ",
};

export function LocaleSwitcher() {
  const t = useTranslations("header");
  const locale = useLocale();
  const pathname = usePathname();

  // A full page load, not a client-side route change: switching locale swaps
  // the [locale] root layout, and re-rendering that in the browser re-creates
  // its inline theme <script> (React warns and never runs it) and keeps the
  // old <html lang>. A fresh document from the server avoids both.
  function switchTo(nextLocale: string) {
    const target = getPathname({ href: pathname, locale: nextLocale });
    window.location.assign(target + window.location.search);
  }

  return (
    <div className="relative">
      <Globe className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(e) => switchTo(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border bg-background py-1 pr-7 pl-8 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABEL[l]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
