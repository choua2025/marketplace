import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AdminPaginationProps {
  /** Page path without query, e.g. "/admin/customers". */
  basePath: string;
  /** Other query params to keep on every page link (search, filter). */
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

/** Page numbers to show: always first and last, plus a window around the current page. */
function pageItems(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) items.push("gap");
    items.push(p);
  });
  return items;
}

export function AdminPagination({
  basePath,
  params,
  page,
  totalPages,
  total,
  pageSize,
}: AdminPaginationProps) {
  const t = useTranslations("admin");

  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const linkClass =
    "flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border bg-background px-2.5 text-sm transition-colors hover:bg-muted";
  const disabledClass =
    "flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-sm text-muted-foreground opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{t("paginationSummary", { from, to, total })}</p>
      {/* Always shown, even for a single page, so every list has the same controls. */}
      <nav aria-label={t("paginationLabel")} className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">{t("prevPage")}</span>
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">{t("prevPage")}</span>
          </span>
        )}

        {pageItems(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={hrefFor(item)}
              aria-label={t("pageNumber", { page: item })}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                linkClass,
                item === page &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
            <span className="hidden sm:inline">{t("nextPage")}</span>
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <span className="hidden sm:inline">{t("nextPage")}</span>
            <ChevronRight className="size-4" />
          </span>
        )}
      </nav>
    </div>
  );
}
