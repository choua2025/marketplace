import { db } from "@/server/db/client";
import type { Actor } from "@/server/lib/actor";

export interface CategoryDto {
  id: number;
  slug: string;
  nameTh: string;
  nameEn: string;
  icon: string;
}

/** Public: every active category, for category pickers and search filters. */
export async function listCategories(_actor: Actor | null): Promise<CategoryDto[]> {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, nameTh: true, nameEn: true, icon: true },
  });
}
