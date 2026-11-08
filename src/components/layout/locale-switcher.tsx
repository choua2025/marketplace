"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Each language's name in itself, for the menu. */
const LOCALE_LABEL: Record<string, string> = {
  th: "ไทย",
  en: "English",
  lo: "ລາວ",
};
/** Shown on the button next to the globe; phones show only the globe. */
const LOCALE_SHORT: Record<string, string> = {
  th: "ไทย",
  en: "EN",
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
  //
  // Thai URLs have no prefix, and the proxy sends an unprefixed URL back to
  // the language remembered in the NEXT_LOCALE cookie (e.g. /en), so store
  // the new language there first.
  function switchTo(nextLocale: string) {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const target = getPathname({ href: pathname, locale: nextLocale });
    window.location.assign(target + window.location.search);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          aria-label={`${t("language")}: ${LOCALE_LABEL[locale]}`}
          title={t("language")}
        >
          <Globe className="size-4.5" />
          <span className="hidden text-sm font-medium sm:inline">{LOCALE_SHORT[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {LOCALE_LABEL[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
