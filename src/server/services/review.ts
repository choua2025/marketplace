import { db } from "@/server/db/client";
import type { Prisma } from "@/server/db/generated/prisma/client";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import type { Actor } from "@/server/lib/actor";
import { createReviewSchema, updateReviewSchema } from "@/lib/validations/review";

const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // can review up to 30 days after completion
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // can edit up to 7 days after writing

export const reviewSelect = {
  id: true,
  bookingId: true,
  customerId: true,
  providerId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect;

export type ReviewDto = Awaited<ReturnType<typeof createReview>>;

/**
 * Creates a review for a completed booking (SPEC.md section 7.7).
 * `provider_id`/`customer_id` always come from the booking row, never from
 * client input -- rating_avg/rating_count update automatically via the
 * `reviews_update_provider_rating` trigger.
 */
export async function createReview(actor: Actor | null, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await enforceRateLimit("review", actor.id);
  const parsed = createReviewSchema.parse(input);

  const booking = await db.booking.findUnique({
    where: { id: parsed.bookingId },
    select: { id: true, customerId: true, providerId: true, status: true, completedAt: true },
  });

  // Not this booking's customer -- BOOKING_NOT_FOUND, same existence-hiding
  // reasoning as the booking service (SPEC.md section 7.3), so no one can
  // probe for bookings that aren't theirs by trying to review them.
  if (!booking || booking.customerId !== actor.id) throw new AppError("BOOKING_NOT_FOUND");
  if (booking.status !== "completed" || !booking.completedAt) {
    throw new AppError("BOOKING_NOT_COMPLETED");
  }
  if (Date.now() - booking.completedAt.getTime() > REVIEW_WINDOW_MS) {
    throw new AppError("REVIEW_WINDOW_EXPIRED");
  }

  const existing = await db.review.findUnique({
    where: { bookingId: booking.id },
    select: { id: true },
  });
  if (existing) throw new AppError("REVIEW_EXISTS");

  return db.review.create({
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      rating: parsed.rating,
      comment: parsed.comment ?? null,
    },
    select: reviewSelect,
  });
}

/** Edits an existing review's rating/comment, within the 7-day edit window. */
export async function updateReview(actor: Actor | null, reviewId: string, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  await enforceRateLimit("review", actor.id);
  const parsed = updateReviewSchema.parse(input);

  const review = await db.review.findUnique({ where: { id: reviewId }, select: reviewSelect });
  if (!review || review.customerId !== actor.id) throw new AppError("NOT_FOUND");

  if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new AppError("REVIEW_EDIT_WINDOW_EXPIRED");
  }

  return db.review.update({
    where: { id: reviewId },
    data: { rating: parsed.rating, comment: parsed.comment ?? null },
    select: reviewSelect,
  });
}

/** The review for one booking, if any -- for the booking detail page. */
export async function getReviewForBooking(
  actor: Actor | null,
  bookingId: string,
): Promise<ReviewDto | null> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const review = await db.review.findUnique({ where: { bookingId }, select: reviewSelect });
  if (!review) return null;

  const isParty = review.customerId === actor.id || review.providerId === actor.id;
  if (!isParty && actor.role !== "admin") throw new AppError("NOT_FOUND");
  return review;
}

export interface ProviderReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: Date;
}

/** Public: reviews shown on a provider's profile page, newest first. */
export async function listProviderReviews(
  providerId: string,
  limit = 20,
): Promise<ProviderReviewDto[]> {
  const rows = await db.review.findMany({
    where: { providerId },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      customer: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
    customerName: row.customer.fullName,
  }));
}
