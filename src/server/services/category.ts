import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { categories } from "@/server/db/schema";
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
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      nameTh: categories.nameTh,
      nameEn: categories.nameEn,
      icon: categories.icon,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));
}
