import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listCategories } from "@/server/services/category";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const categories = await listCategories(null);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-4 pb-12">
      <section className="flex flex-col gap-4 py-6 text-center">
        <h1 className="text-3xl font-bold">ช่างดี</h1>
        <p className="text-muted-foreground text-lg">หาช่างที่ไว้ใจได้ จองงานได้ภายใน 5 นาที</p>
        <Button asChild className="h-12 w-fit self-center px-8">
          <Link href="/search">
            ค้นหาช่างใกล้คุณ <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">เลือกหมวดงาน</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/search?category=${category.slug}`}
              className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent"
            >
              <CategoryIcon icon={category.icon} className="text-primary size-8" />
              <span className="text-sm font-medium">{category.nameTh}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
