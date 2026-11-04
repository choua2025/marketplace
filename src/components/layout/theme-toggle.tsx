"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Both icons and labels are rendered and the `dark` class (set before paint
// by the root layout's inline script) picks which one shows. Choosing them
// in JS instead would make the server and client HTML differ in dark mode,
// and React then re-renders the whole page on hydration.
export function ThemeToggle() {
  const t = useTranslations("header");

  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={toggle}>
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <span className="sr-only dark:hidden">{t("toDarkMode")}</span>
      <span className="sr-only hidden dark:inline">{t("toLightMode")}</span>
    </Button>
  );
}
