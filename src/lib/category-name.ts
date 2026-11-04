// Categories only have Thai and English names in the DB -- Lao falls back
// to English until a Lao column exists.
export function categoryName(category: { nameTh: string; nameEn: string }, locale: string) {
  return locale === "th" ? category.nameTh : category.nameEn;
}
