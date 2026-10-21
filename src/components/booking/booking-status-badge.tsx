import type { BookingStatus } from "@/lib/validations/booking";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "รออนุมัติ",
  confirmed: "ยืนยันแล้ว",
  in_progress: "กำลังทำงาน",
  completed: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-muted text-muted-foreground",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
