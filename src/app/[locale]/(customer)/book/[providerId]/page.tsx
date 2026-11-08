import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loginHref } from "@/lib/login-next";
import { getActor } from "@/server/auth/session";
import { getPublicProviderProfile } from "@/server/services/provider";
import { listBusyTimes } from "@/server/services/booking-read";
import { AppError } from "@/server/lib/errors";
import { BookingForm } from "@/components/booking/booking-form";

// This page renders per request (it reads the session), so "now" is the
// request time -- passed down so the time picker's server render and
// hydration show the same days.
function requestTime(): number {
  return Date.now();
}

export default async function BookProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const actor = await getActor();
  if (!actor) throw redirect({ href: loginHref(`/book/${providerId}`), locale: await getLocale() });

  let provider;
  try {
    provider = await getPublicProviderProfile(actor, providerId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const [t, busy] = await Promise.all([getTranslations("booking"), listBusyTimes(provider.id)]);

  if (actor.role !== "customer") {
    return (
      <main className="mx-auto flex flex-1 max-w-md items-center justify-center p-4 text-center">
        <p className="text-muted-foreground">{t("customersOnly")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-12">
      <section className="rounded-2xl bg-primary px-6 py-8 text-primary-foreground">
        <h1 className="text-2xl font-bold">{t("pageTitle", { name: provider.displayName })}</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">{t("pageSubtitle")}</p>
      </section>
      <BookingForm
        providerId={provider.id}
        categories={provider.categories}
        basePrice={provider.basePrice}
        priceUnit={provider.priceUnit}
        availability={provider.availability}
        timezone={provider.timezone}
        busy={busy}
        now={requestTime()}
      />
    </main>
  );
}
