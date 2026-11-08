import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { ArrowRight, MessageCircle, Search, ShieldCheck, Star } from "lucide-react";
import { listCategories } from "@/server/services/category";
import { getPublicStats } from "@/server/services/stats";
import { listFeaturedProviders } from "@/server/services/search";
import { getSignedImageUrl } from "@/server/services/upload";
import { CategoryIcon } from "@/components/category-icon";
import { ProviderCard } from "@/components/search/provider-card";
import { Button } from "@/components/ui/button";

// Reads from the DB on every request instead of at build time -- a
// Docker build has no database to reach, and the category list changes
// rarely enough that this has no real performance cost.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, stats, featuredRows, locale, t] = await Promise.all([
    listCategories(null),
    getPublicStats(null),
    listFeaturedProviders(null),
    getLocale(),
    getTranslations("home"),
  ]);
  const featured = await Promise.all(
    featuredRows.map(async (row) => ({
      ...row,
      avatarUrl: await getSignedImageUrl(row.avatarKey),
      isFavorited: false,
    })),
  );
  const steps = [
    { icon: Search, title: t("step1Title"), body: t("step1Body") },
    { icon: MessageCircle, title: t("step2Title"), body: t("step2Body") },
    { icon: Star, title: t("step3Title"), body: t("step3Body") },
  ];
  // Categories only have Thai/English names in the DB (SPEC.md's schema
  // never grew a Lao column) -- Lao falls back to English until it does.
  const categoryName = (category: { nameTh: string; nameEn: string }) =>
    locale === "th" ? category.nameTh : category.nameEn;

  const numberFormat = new Intl.NumberFormat(locale === "lo" ? "lo" : locale);
  const headlineStats = [
    { label: t("statVerifiedProviders"), value: stats.verifiedProviders },
    { label: t("statCompletedBookings"), value: stats.completedBookings },
    { label: t("statCustomers"), value: stats.customers },
  ];

  return (
    <main className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 lg:grid-cols-2 lg:items-center lg:gap-10 lg:py-20">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("heroEyebrow")}
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t("heroTitle")} <span className="text-primary">{t("heroTitleAccent")}</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">{t("heroSubtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-12 px-8">
                <Link href="/search">
                  {t("findNearMe")} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-8">
                <Link href="/register?role=provider">{t("becomeProvider")}</Link>
              </Button>
            </div>

            <dl className="mt-4 grid max-w-md grid-cols-3 gap-4 border-t pt-6">
              {headlineStats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-2xl font-bold sm:text-3xl">
                    {numberFormat.format(stat.value)}
                  </dt>
                  <dd className="text-sm text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md pb-6 lg:max-w-none">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-fit items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-sm">
                <ShieldCheck className="size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm leading-tight font-bold">{t("satisfactionBadgeTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("satisfactionBadgeSubtitle")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {stats.recentCustomers.length > 0 ? (
                  <div className="flex -space-x-3" aria-hidden="true">
                    {stats.recentCustomers.map((customer, index) => (
                      <span
                        key={index}
                        className="relative flex size-10 items-center justify-center overflow-hidden rounded-full border-2 border-background text-sm font-semibold"
                        style={{
                          background: `hsl(${customer.hue} 70% 88%)`,
                          color: `hsl(${customer.hue} 55% 30%)`,
                        }}
                      >
                        {customer.imageUrl ? (
                          <Image
                            src={customer.imageUrl}
                            alt=""
                            fill
                            sizes="40px"
                            unoptimized
                            // Google sign-in photos refuse requests with our site as referrer.
                            referrerPolicy="no-referrer"
                            className="object-cover"
                          />
                        ) : (
                          customer.initial
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div>
                  <p className="text-sm leading-tight font-bold">
                    {numberFormat.format(stats.customers)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("statCustomers")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
              <Image
                src="/hero/cleaning.jpg"
                alt=""
                width={700}
                height={850}
                className="col-span-3 aspect-[4/5] w-full rounded-3xl object-cover shadow-sm"
              />
              <div className="col-span-2 flex flex-col gap-4">
                <Image
                  src="/hero/electrician.jpg"
                  alt=""
                  width={500}
                  height={400}
                  className="aspect-square w-full rounded-3xl object-cover shadow-sm"
                />
                <Image
                  src="/hero/handyman.jpg"
                  alt=""
                  width={500}
                  height={400}
                  className="aspect-square w-full rounded-3xl object-cover shadow-sm"
                />
              </div>
            </div>

            {stats.avgRating !== null && (
              <div className="absolute -bottom-2 left-4 flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-lg">
                <Star className="size-5 shrink-0 fill-amber-400 text-amber-400" />
                <div>
                  <p className="text-sm leading-tight font-bold">
                    {stats.avgRating.toFixed(1)} / 5
                  </p>
                  <p className="text-xs text-muted-foreground">{t("ratingBadge")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("chooseCategory")}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/search?category=${category.slug}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border bg-card px-4 py-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <CategoryIcon icon={category.icon} className="size-7" />
              </span>
              <span className="text-sm font-medium">{categoryName(category)}</span>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="border-y bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t("featuredTitle")}
                </h2>
                <p className="mt-1 text-muted-foreground">{t("featuredSubtitle")}</p>
              </div>
              <Link
                href="/search"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("viewAllProviders")} <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {featured.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} showDistance={false} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          {t("howTitle")}
        </h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-6" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="flex flex-col items-start gap-6 overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground shadow-lg sm:px-10 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="text-primary-foreground/85">{t("ctaBody")}</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="h-12 shrink-0 px-6">
            <Link href="/register?role=provider">
              {t("ctaButton")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
