import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { listMyBookings } from "@/server/services/booking-read";
import type { BookingStatus } from "@/lib/validations/booking";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";

const TABS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รออนุมัติ" },
  { value: "confirmed", label: "ยืนยันแล้ว" },
  { value: "in_progress", label: "กำลังทำงาน" },
  { value: "completed", label: "เสร็จแล้ว" },
  { value: "cancelled", label: "ยกเลิก" },
];

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const { status } = await searchParams;
  const activeStatus = (status as BookingStatus | undefined) ?? undefined;
  const bookingsList = await listMyBookings(actor, activeStatus);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">การจองของฉัน</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/bookings" : `/bookings?status=${tab.value}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              (activeStatus ?? "all") === tab.value ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {bookingsList.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">ยังไม่มีรายการจอง</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookingsList.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
            >
              <div>
                <p className="font-medium">{booking.counterpartyName}</p>
                <p className="text-muted-foreground text-sm">{booking.categoryNameTh}</p>
                <p className="text-muted-foreground text-xs">
                  {booking.startAt.toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
