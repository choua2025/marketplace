import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getBookingDetail } from "@/server/services/booking-read";
import { getReviewForBooking } from "@/server/services/review";
import { AppError } from "@/server/lib/errors";
import { ReviewForm } from "@/components/review/review-form";

export default async function WriteReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale });

  let booking;
  try {
    booking = await getBookingDetail(actor, bookingId);
  } catch (error) {
    if (error instanceof AppError && error.code === "BOOKING_NOT_FOUND") notFound();
    throw error;
  }

  if (booking.customerId !== actor.id || booking.status !== "completed") {
    throw redirect({ href: `/bookings/${bookingId}`, locale });
  }

  const existingReview = await getReviewForBooking(actor, bookingId);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-xl font-bold">
        {existingReview ? "แก้ไขรีวิว" : "เขียนรีวิว"} {booking.providerDisplayName}
      </h1>
      <ReviewForm
        bookingId={bookingId}
        reviewId={existingReview?.id ?? null}
        initialRating={existingReview?.rating ?? 5}
        initialComment={existingReview?.comment ?? ""}
      />
    </main>
  );
}
