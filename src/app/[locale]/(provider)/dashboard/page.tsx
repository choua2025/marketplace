import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardList, Inbox, MessageCircle, UserPen } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listMyBookings } from "@/server/services/booking-read";
import { Button } from "@/components/ui/button";
import { BecomeProviderPrompt } from "@/components/provider/become-provider-prompt";
import { BookingListItem } from "@/components/booking/booking-list-item";

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default async function ProviderDashboardPage() {
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) {
    throw redirect({ href: "/login", locale });
  }

  if (actor.role !== "provider") {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <BecomeProviderPrompt />
      </main>
    );
  }

  const [allBookings, t, tMenu] = await Promise.all([
    listMyBookings(actor),
    getTranslations("dashboard"),
    getTranslations("userMenu"),
  ]);
  const newRequests = allBookings.filter((b) => b.status === "pending");
  const todayJobs = allBookings.filter(
    (b) => (b.status === "confirmed" || b.status === "in_progress") && isToday(b.startAt),
  );

  const sections = [
    {
      title: t("todayJobs", { count: todayJobs.length }),
      items: todayJobs,
      empty: t("noTodayJobs"),
    },
    {
      title: t("newRequests", { count: newRequests.length }),
      items: newRequests,
      empty: t("noNewRequests"),
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/profile">
              <UserPen className="size-4" /> {tMenu("editProfile")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/messages">
              <MessageCircle className="size-4" /> {tMenu("messages")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/bookings">
              <ClipboardList className="size-4" /> {t("viewAll")}
            </Link>
          </Button>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.items.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
              <Inbox className="size-5 shrink-0" />
              {section.empty}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {section.items.map((booking) => (
                <BookingListItem key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
