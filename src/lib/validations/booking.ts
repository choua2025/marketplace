import { z } from "zod";

export const createBookingSchema = z
  .object({
    providerId: z.string().min(1),
    categorySlug: z.string().min(1),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    description: z.string().trim().min(10).max(2000),
    address: z.string().trim().min(5).max(300),
    photoKeys: z.array(z.string().min(1)).max(5).default([]),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  })
  .refine((data) => data.endAt.getTime() - data.startAt.getTime() <= 12 * 60 * 60 * 1000, {
    message: "A booking can't be longer than 12 hours",
    path: ["endAt"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const updateBookingStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  cancelReason: z.string().trim().min(1).max(500).optional(),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
