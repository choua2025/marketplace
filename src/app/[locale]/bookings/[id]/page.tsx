import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { Star } from "lucide-react";
import { getActor } from "@/server/auth/session";
import { getBookingContact, getBookingDetail } from "@/server/services/booking-read";
import { getReviewForBooking } from "@/server/services/review";
import { AppError } from "@/server/lib/errors";
import { categoryName } from "@/lib/category-name";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { BookingActions } from "@/components/booking/booking-actions";

async function loadContact(actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, id: string) {
  try {
    return await getBookingContact(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "CONTACT_LOCKED") return null;
    throw error;
  }
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale });

  let booking;
  try {
    booking = await getBookingDetail(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "BOOKING_NOT_FOUND") notFound();
    throw error;
  }

  const isCustomer = booking.customerId === actor.id;
  const isProvider = booking.providerId === actor.id;
  const contact = await loadContact(actor, id);
  const review = booking.status === "completed" ? await getReviewForBooking(actor, id) : null;
  const [t, tCommon, format] = await Promise.all([
    getTranslations("booking"),
    getTranslations("common"),
    getFormatter(),
  ]);

  const timeline = [
    { label: t("timelineCreated"), at: booking.createdAt },
    { label: t("timelineConfirmed"), at: booking.confirmedAt },
    { label: t("timelineStarted"), at: booking.startedAt },
    { label: t("timelineCompleted"), at: booking.completedAt },
    { label: t("timelineCancelled"), at: booking.cancelledAt },
  ].filter((step) => step.at !== null);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isCustomer ? booking.providerDisplayName : booking.customerName}
        </h1>
        <BookingStatusBadge status={booking.status} />
      </div>

      <section className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
        <p>
          <span className="text-muted-foreground">{t("categoryLabel")}:</span>{" "}
          {categoryName({ nameTh: booking.categoryNameTh, nameEn: booking.categoryNameEn }, locale)}
        </p>
        <p>
          <span className="text-muted-foreground">{t("timeLabel")}:</span>{" "}
          {format.dateTime(booking.startAt, { dateStyle: "medium", timeStyle: "short" })} -{" "}
          {format.dateTime(booking.endAt, { timeStyle: "short" })}
        </p>
        <p>
          <span className="text-muted-foreground">{t("detailsLabel")}:</span> {booking.description}
        </p>
        <p>
          <span className="text-muted-foreground">{t("addressShortLabel")}:</span> {booking.address}
        </p>
        {booking.cancelReason ? (
          <p>
            <span className="text-muted-foreground">{t("cancelReasonLabel")}:</span>{" "}
            {booking.cancelReason}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border p-3 text-sm">
        <h2 className="mb-2 font-medium">{t("contactTitle")}</h2>
        {contact ? (
          <div className="flex flex-col gap-1">
            <p>
              {t("phoneLabel")}: {contact.phone ?? tCommon("notSpecified")}
            </p>
            {contact.lineId ? <p>LINE: {contact.lineId}</p> : null}
          </div>
        ) : (
          <p className="text-muted-foreground">{t("contactLocked")}</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">{t("timelineTitle")}</h2>
        <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
          {timeline.map((step) => (
            <li key={step.label}>
              {step.label}:{" "}
              {step.at
                ? format.dateTime(step.at, { dateStyle: "medium", timeStyle: "short" })
                : null}
            </li>
          ))}
        </ul>
      </section>

      {isCustomer && booking.status === "completed" ? (
        <section className="rounded-lg border p-3 text-sm">
          <h2 className="mb-2 font-medium">{t("reviewTitle")}</h2>
          {review ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${i < review.rating ? "fill-current text-amber-500" : "text-muted-foreground"}`}
                  />
                ))}
              </div>
              {review.comment ? <p>{review.comment}</p> : null}
              <Link href={`/bookings/${booking.id}/review`} className="text-primary underline">
                {t("editReview")}
              </Link>
            </div>
          ) : (
            <Link href={`/bookings/${booking.id}/review`}>
              <span className="text-primary underline">{t("writeReview")}</span>
            </Link>
          )}
        </section>
      ) : null}

      <BookingActions
        bookingId={booking.id}
        status={booking.status}
        isCustomer={isCustomer}
        isProvider={isProvider}
      />
    </main>
  );
}
