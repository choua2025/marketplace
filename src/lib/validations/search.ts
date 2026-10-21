import { z } from "zod";

export const searchSortSchema = z.enum(["recommended", "distance", "rating", "price"]);

export const searchProvidersSchema = z.object({
  categorySlug: z.string().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  maxKm: z.coerce.number().min(1).max(200).default(25),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: searchSortSchema.default("recommended"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchProvidersInput = z.infer<typeof searchProvidersSchema>;
