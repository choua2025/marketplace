import { CalendarDays, ChevronRight } from "lucide-react";
import { useFormatter, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BookingListItemDto } from "@/server/services/booking-read";
import { categoryName } from "@/lib/category-name";
import { CategoryIcon } from "@/components/category-icon";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";

/** One booking row, shared by "My bookings" and the provider dashboard. */
export function BookingListItem({ booking }: { booking: BookingListItemDto }) {
  const format = useFormatter();
  const locale = useLocale();

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CategoryIcon icon={booking.categoryIcon} className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-medium">{booking.counterpartyName}</p>
        <p className="truncate text-sm text-muted-foreground">
          {categoryName({ nameTh: booking.categoryNameTh, nameEn: booking.categoryNameEn }, locale)}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {format.dateTime(booking.startAt, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <BookingStatusBadge status={booking.status} />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
