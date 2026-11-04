import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const [t, tHeader, tCommon] = await Promise.all([
    getTranslations("footer"),
    getTranslations("header"),
    getTranslations("common"),
  ]);
  const brand = tCommon("brand");

  const columns = [
    {
      title: t("colExplore"),
      links: [
        { href: "/search", label: tHeader("navFindPro") },
        { href: "/register?role=provider", label: t("becomeProvider") },
      ],
    },
    {
      title: t("colSupport"),
      links: [
        { href: "/help", label: t("help") },
        { href: "/contact", label: t("contact") },
      ],
    },
    {
      title: t("colLegal"),
      links: [
        { href: "/terms", label: t("terms") },
        { href: "/privacy", label: t("privacy") },
      ],
    },
  ];

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Link href="/" className="flex w-fit items-center gap-2 font-heading text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
              {brand.charAt(0)}
            </span>
            {brand}
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{column.title}</h2>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted-foreground">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
