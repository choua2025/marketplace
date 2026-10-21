import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { bookings, profiles, reviews } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Actor } from "@/server/lib/actor";
import { createReviewSchema, updateReviewSchema } from "@/lib/validations/review";

const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // can review up to 30 days after completion
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // can edit up to 7 days after writing

export const reviewColumns = {
  id: reviews.id,
  bookingId: reviews.bookingId,
  customerId: reviews.customerId,
  providerId: reviews.providerId,
  rating: reviews.rating,
  comment: reviews.comment,
  createdAt: reviews.createdAt,
  updatedAt: reviews.updatedAt,
};

export type ReviewDto = Awaited<ReturnType<typeof createReview>>;

/**
 * Creates a review for a completed booking (SPEC.md section 7.7).
 * `provider_id`/`customer_id` always come from the booking row, never from
 * client input -- rating_avg/rating_count update automatically via the
 * `reviews_update_provider_rating` trigger.
 */
export async function createReview(actor: Actor | null, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  const parsed = createReviewSchema.parse(input);

  const [booking] = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      providerId: bookings.providerId,
      status: bookings.status,
      completedAt: bookings.completedAt,
    })
    .from(bookings)
    .where(eq(bookings.id, parsed.bookingId));

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

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.bookingId, booking.id));
  if (existing) throw new AppError("REVIEW_EXISTS");

  const [created] = await db
    .insert(reviews)
    .values({
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      rating: parsed.rating,
      comment: parsed.comment ?? null,
    })
    .returning(reviewColumns);

  if (!created) throw new Error("failed to insert review");
  return created;
}

/** Edits an existing review's rating/comment, within the 7-day edit window. */
export async function updateReview(actor: Actor | null, reviewId: string, input: unknown) {
  if (!actor) throw new AppError("UNAUTHORIZED");
  const parsed = updateReviewSchema.parse(input);

  const [review] = await db.select(reviewColumns).from(reviews).where(eq(reviews.id, reviewId));
  if (!review || review.customerId !== actor.id) throw new AppError("NOT_FOUND");

  if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new AppError("REVIEW_EDIT_WINDOW_EXPIRED");
  }

  const [updated] = await db
    .update(reviews)
    .set({ rating: parsed.rating, comment: parsed.comment ?? null })
    .where(eq(reviews.id, reviewId))
    .returning(reviewColumns);

  if (!updated) throw new Error("failed to update review");
  return updated;
}

/** The review for one booking, if any -- for the booking detail page. */
export async function getReviewForBooking(
  actor: Actor | null,
  bookingId: string,
): Promise<ReviewDto | null> {
  if (!actor) throw new AppError("UNAUTHORIZED");

  const [review] = await db
    .select(reviewColumns)
    .from(reviews)
    .where(eq(reviews.bookingId, bookingId));
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
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      customerName: profiles.fullName,
    })
    .from(reviews)
    .innerJoin(profiles, eq(profiles.id, reviews.customerId))
    .where(eq(reviews.providerId, providerId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
