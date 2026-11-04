import { ClipboardList, ShieldAlert, Store, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getAdminStats } from "@/server/services/admin";
import { cn } from "@/lib/utils";

const BOOKING_STATUS_ORDER = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 rounded-xl border bg-background p-4 shadow-sm transition-shadow hover:shadow-md",
        highlight && "border-amber-300 dark:border-amber-700",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          highlight
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
            : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
      </span>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const actor = await getActor();
  const [stats, t, tBooking] = await Promise.all([
    getAdminStats(actor),
    getTranslations("admin"),
    getTranslations("admin.bookingStatus"),
  ]);
  const totalBookings = Object.values(stats.bookingsByStatus).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <>
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="/admin/customers"
          label={t("totalCustomers")}
          value={stats.totalCustomers}
          icon={Users}
        />
        <StatCard
          href="/admin/providers"
          label={t("totalProviders")}
          value={stats.totalProviders}
          icon={Store}
        />
        <StatCard
          href="/admin/providers?filter=pending"
          label={t("pendingVerifications")}
          value={stats.pendingVerifications}
          icon={ShieldAlert}
          highlight={stats.pendingVerifications > 0}
        />
        <StatCard
          href="/admin/bookings"
          label={t("navBookings")}
          value={totalBookings}
          icon={ClipboardList}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("bookingsByStatus")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {BOOKING_STATUS_ORDER.map((status) => (
            <Link
              key={status}
              href={`/admin/bookings?status=${status}`}
              className="rounded-xl border bg-background p-4 transition-shadow hover:shadow-md"
            >
              <p className="text-sm text-muted-foreground">{tBooking(status)}</p>
              <p className="text-2xl font-bold tabular-nums">
                {stats.bookingsByStatus[status] ?? 0}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
