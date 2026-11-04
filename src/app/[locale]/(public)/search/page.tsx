import { getTranslations } from "next-intl/server";
import { listCategories } from "@/server/services/category";
import { SearchClient } from "@/components/search/search-client";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category }, categories, t] = await Promise.all([
    searchParams,
    listCategories(null),
    getTranslations("search"),
  ]);

  return (
    // Desktop: exactly the viewport below the 4rem (h-16) sticky site header,
    // so the title and filters stay in place and only the results scroll.
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <SearchClient allCategories={categories} initialCategorySlug={category} />
    </main>
  );
}
