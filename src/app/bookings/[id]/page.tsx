import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getBookingContact, getBookingDetail } from "@/server/services/booking-read";
import { AppError } from "@/server/lib/errors";
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
  const actor = await getActor();
  if (!actor) redirect("/login");

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

  const timeline = [
    { label: "สร้างคำขอ", at: booking.createdAt },
    { label: "ยืนยันแล้ว", at: booking.confirmedAt },
    { label: "เริ่มงาน", at: booking.startedAt },
    { label: "เสร็จงาน", at: booking.completedAt },
    { label: "ยกเลิก", at: booking.cancelledAt },
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
          <span className="text-muted-foreground">หมวดงาน:</span> {booking.categoryNameTh}
        </p>
        <p>
          <span className="text-muted-foreground">เวลา:</span>{" "}
          {booking.startAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} -{" "}
          {booking.endAt.toLocaleString("th-TH", { timeStyle: "short" })}
        </p>
        <p>
          <span className="text-muted-foreground">รายละเอียด:</span> {booking.description}
        </p>
        <p>
          <span className="text-muted-foreground">ที่อยู่:</span> {booking.address}
        </p>
        {booking.cancelReason ? (
          <p>
            <span className="text-muted-foreground">เหตุผลที่ยกเลิก:</span> {booking.cancelReason}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border p-3 text-sm">
        <h2 className="mb-2 font-medium">ข้อมูลติดต่อ</h2>
        {contact ? (
          <div className="flex flex-col gap-1">
            <p>โทร: {contact.phone ?? "ไม่ระบุ"}</p>
            {contact.lineId ? <p>LINE: {contact.lineId}</p> : null}
          </div>
        ) : (
          <p className="text-muted-foreground">จะเห็นข้อมูลติดต่อหลังช่างยืนยันงานแล้ว</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">ไทม์ไลน์</h2>
        <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
          {timeline.map((step) => (
            <li key={step.label}>
              {step.label}:{" "}
              {step.at?.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </li>
          ))}
        </ul>
      </section>

      <BookingActions
        bookingId={booking.id}
        status={booking.status}
        isCustomer={isCustomer}
        isProvider={isProvider}
      />
    </main>
  );
}
