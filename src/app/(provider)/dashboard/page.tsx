import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { listMyBookings } from "@/server/services/booking-read";
import { BecomeProviderPrompt } from "@/components/provider/become-provider-prompt";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default async function ProviderDashboardPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  if (actor.role !== "provider") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <BecomeProviderPrompt />
      </main>
    );
  }

  const allBookings = await listMyBookings(actor);
  const newRequests = allBookings.filter((b) => b.status === "pending");
  const todayJobs = allBookings.filter(
    (b) => (b.status === "confirmed" || b.status === "in_progress") && isToday(b.startAt),
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">แดชบอร์ดช่าง</h1>
        <Link href="/bookings" className="text-primary text-sm underline">
          ดูทั้งหมด
        </Link>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">งานวันนี้ ({todayJobs.length})</h2>
        {todayJobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">ไม่มีงานวันนี้</p>
        ) : (
          <BookingList items={todayJobs} />
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">คำขอใหม่ ({newRequests.length})</h2>
        {newRequests.length === 0 ? (
          <p className="text-muted-foreground text-sm">ยังไม่มีคำขอใหม่</p>
        ) : (
          <BookingList items={newRequests} />
        )}
      </section>
    </main>
  );
}

function BookingList({ items }: { items: Awaited<ReturnType<typeof listMyBookings>> }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((booking) => (
        <Link
          key={booking.id}
          href={`/bookings/${booking.id}`}
          className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
        >
          <div>
            <p className="font-medium">{booking.counterpartyName}</p>
            <p className="text-muted-foreground text-sm">{booking.categoryNameTh}</p>
            <p className="text-muted-foreground text-xs">
              {booking.startAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </Link>
      ))}
    </div>
  );
}
