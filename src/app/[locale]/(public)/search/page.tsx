import { listCategories } from "@/server/services/category";
import { SearchClient } from "@/components/search/search-client";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const categories = await listCategories(null);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">ค้นหาช่าง</h1>
      <SearchClient allCategories={categories} initialCategorySlug={category} />
    </main>
  );
}
