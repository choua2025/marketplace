import { z } from "zod";

export const searchSortSchema = z.enum([
  "recommended",
  "distance",
  "rating",
  "price",
  "mostBooked",
  "newest",
]);
export type SearchSort = z.infer<typeof searchSortSchema>;

export const searchProvidersSchema = z.object({
  /** Free text: matched against name, bio, area and category names. */
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((q) => q || undefined),
  categorySlug: z.string().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  maxKm: z.coerce.number().min(1).max(200).default(25),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  verifiedOnly: z.boolean().optional(),
  sort: searchSortSchema.default("recommended"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchProvidersInput = z.input<typeof searchProvidersSchema>;
