import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleSlash,
  FileText,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Star,
} from "lucide-react";
import { getActor } from "@/server/auth/session";
import { getBookingContact, getBookingDetail } from "@/server/services/booking-read";
import { getReviewForBooking } from "@/server/services/review";
import { getSignedImageUrl } from "@/server/services/upload";
import { AppError } from "@/server/lib/errors";
import { categoryName } from "@/lib/category-name";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm break-words whitespace-pre-line">{children}</div>
      </div>
    </div>
  );
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
  // The header shows whoever is on the other side of the booking.
  const otherPartyName = isCustomer ? booking.providerDisplayName : booking.customerName;
  const [t, tCommon, format, otherPartyAvatarUrl] = await Promise.all([
    getTranslations("booking"),
    getTranslations("common"),
    getFormatter(),
    getSignedImageUrl(isCustomer ? booking.providerAvatarKey : booking.customerAvatarKey),
  ]);

  const category = categoryName(
    { nameTh: booking.categoryNameTh, nameEn: booking.categoryNameEn },
    locale,
  );
  const timeline = [
    { label: t("timelineCreated"), at: booking.createdAt },
    { label: t("timelineConfirmed"), at: booking.confirmedAt },
    { label: t("timelineStarted"), at: booking.startedAt },
    { label: t("timelineCompleted"), at: booking.completedAt },
    { label: t("timelineCancelled"), at: booking.cancelledAt, cancelled: true },
  ].filter((step) => step.at !== null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-16">
      {isCustomer ? (
        <Link
          href="/bookings"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t("myBookingsTitle")}
        </Link>
      ) : null}

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-14 shrink-0">
            <AvatarImage
              src={otherPartyAvatarUrl ?? undefined}
              alt={otherPartyName}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {initials(otherPartyName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">{otherPartyName}</h1>
            <p className="truncate text-sm text-muted-foreground">{category}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <DetailRow icon={CalendarClock} label={t("timeLabel")}>
            {format.dateTime(booking.startAt, { dateStyle: "medium", timeStyle: "short" })} –{" "}
            {format.dateTime(booking.endAt, { dateStyle: "medium", timeStyle: "short" })}
          </DetailRow>
          <DetailRow icon={FileText} label={t("detailsLabel")}>
            {booking.description}
          </DetailRow>
          <DetailRow icon={MapPin} label={t("addressShortLabel")}>
            {booking.address}
          </DetailRow>
          {booking.cancelReason ? (
            <DetailRow icon={CircleSlash} label={t("cancelReasonLabel")}>
              {booking.cancelReason}
            </DetailRow>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("contactTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contact ? (
            <>
              <DetailRow icon={Phone} label={t("phoneLabel")}>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="font-medium text-primary">
                    {contact.phone}
                  </a>
                ) : (
                  tCommon("notSpecified")
                )}
              </DetailRow>
              {contact.lineId ? (
                <DetailRow icon={MessageCircle} label="LINE">
                  {contact.lineId}
                </DetailRow>
              ) : null}
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" /> {t("contactLocked")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("timelineTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col">
            {timeline.map((step, index) => {
              const last = index === timeline.length - 1;
              return (
                <li key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "mt-1 size-3 shrink-0 rounded-full",
                        step.cancelled
                          ? "bg-destructive"
                          : last
                            ? "bg-primary ring-4 ring-primary/20"
                            : "bg-primary/60",
                      )}
                    />
                    {last ? null : <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className={cn("flex flex-col", last ? "" : "pb-4")}>
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {step.at
                        ? format.dateTime(step.at, { dateStyle: "medium", timeStyle: "short" })
                        : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {isCustomer && booking.status === "completed" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {review ? (
              <>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-5",
                        i < review.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground",
                      )}
                    />
                  ))}
                </div>
                {review.comment ? <p className="whitespace-pre-line">{review.comment}</p> : null}
                <Link
                  href={`/bookings/${booking.id}/review`}
                  className="w-fit font-medium text-primary hover:underline"
                >
                  {t("editReview")}
                </Link>
              </>
            ) : (
              <Link
                href={`/bookings/${booking.id}/review`}
                className="w-fit font-medium text-primary hover:underline"
              >
                {t("writeReview")}
              </Link>
            )}
          </CardContent>
        </Card>
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
