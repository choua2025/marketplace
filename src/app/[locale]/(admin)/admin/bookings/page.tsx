import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listBookingsForAdmin, parsePage } from "@/server/services/admin";
import type { BookingStatus } from "@/lib/validations/booking";
import { cn } from "@/lib/utils";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { AdminPagination } from "@/components/admin/admin-pagination";

const TAB_VALUES: (BookingStatus | "all")[] = [
  "all",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const [actor, { status, page }, t, tBooking, format] = await Promise.all([
    getActor(),
    searchParams,
    getTranslations("admin"),
    getTranslations("admin.bookingStatus"),
    getFormatter(),
  ]);
  const activeStatus =
    status !== "all" && TAB_VALUES.includes(status as BookingStatus)
      ? (status as BookingStatus)
      : undefined;
  const result = await listBookingsForAdmin(actor, {
    status: activeStatus,
    page: parsePage(page),
  });
  const bookings = result.items;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t("navBookings")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("resultsCount", { count: result.total })}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TAB_VALUES.map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/bookings" : `/admin/bookings?status=${value}`}
            aria-current={(activeStatus ?? "all") === value ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
              (activeStatus ?? "all") === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            {value === "all" ? t("statusAll") : tBooking(value)}
          </Link>
        ))}
      </div>

      <div className="flex flex-col divide-y rounded-xl border bg-background">
        {bookings.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("noResults")}</p>
        ) : null}
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {booking.customerName} → {booking.providerName}
              </p>
              <p className="text-xs text-muted-foreground">
                {format.dateTime(booking.startAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <BookingStatusBadge status={booking.status} />
          </Link>
        ))}
      </div>
      <AdminPagination
        basePath="/admin/bookings"
        params={{ status: activeStatus }}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
}
