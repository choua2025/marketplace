import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardList, MessageCircle } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listMyBookings } from "@/server/services/booking-read";
import type { BookingStatus } from "@/lib/validations/booking";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BookingListItem } from "@/components/booking/booking-list-item";

const STATUS_TABS: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale });

  const { status } = await searchParams;
  // Unknown values (e.g. a hand-typed ?status=) mean "all", never a DB error.
  const activeStatus = STATUS_TABS.includes(status as BookingStatus)
    ? (status as BookingStatus)
    : undefined;
  const [bookingsList, t, tStatus, tMenu, tHeader] = await Promise.all([
    listMyBookings(actor, activeStatus),
    getTranslations("booking"),
    getTranslations("bookingStatus"),
    getTranslations("userMenu"),
    getTranslations("header"),
  ]);

  const tabs: { value: BookingStatus | "all"; label: string }[] = [
    { value: "all", label: t("filterAll") },
    ...STATUS_TABS.map((value) => ({ value, label: tStatus(value) })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("myBookingsTitle")}</h1>
        <Button asChild variant="outline">
          <Link href="/messages">
            <MessageCircle className="size-4" /> {tMenu("messages")}
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = (activeStatus ?? "all") === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/bookings" : `/bookings?status=${tab.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {bookingsList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="size-6" />
          </span>
          <p className="text-muted-foreground">{t("empty")}</p>
          <Button asChild>
            <Link href="/search">{tHeader("navFindPro")}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookingsList.map((booking) => (
            <BookingListItem key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </main>
  );
}
