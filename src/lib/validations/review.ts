import { z } from "zod";

export const createReviewSchema = z.object({
  bookingId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
