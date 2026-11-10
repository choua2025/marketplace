import { ChevronRight, Home } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listCategories } from "@/server/services/category";
import { SearchClient } from "@/components/search/search-client";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const [{ category, q }, categories, t] = await Promise.all([
    searchParams,
    listCategories(null),
    getTranslations("search"),
  ]);

  return (
    // Desktop: exactly the viewport below the 4rem (h-16) sticky site header,
    // so the filters and toolbar stay in place and only the results scroll.
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="flex items-center gap-1.5 hover:text-foreground">
              <Home className="size-4" aria-hidden />
              {t("breadcrumbHome")}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-4" />
          </li>
          <li aria-current="page" className="font-medium text-primary">
            {t("title")}
          </li>
        </ol>
      </nav>
      <SearchClient
        allCategories={categories}
        initialCategorySlug={category}
        initialQuery={typeof q === "string" ? q.slice(0, 100) : undefined}
      />
    </main>
  );
}
