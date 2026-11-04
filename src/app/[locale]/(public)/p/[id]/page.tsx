import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { getPublicProviderProfile } from "@/server/services/provider";
import { getSignedImageUrl } from "@/server/services/upload";
import { listProviderReviews } from "@/server/services/review";
import { isFavorited as checkIsFavorited } from "@/server/services/favorite";
import { getActor } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { env } from "@/server/lib/env";
import { categoryName } from "@/lib/category-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/category-icon";
import { ProviderMapLoader } from "@/components/map/provider-map-loader";
import { StartChatButton } from "@/components/chat/start-chat-button";
import { FavoriteButton } from "@/components/provider/favorite-button";

async function loadProfile(id: string) {
  try {
    return await getPublicProviderProfile(null, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [profile, t, tCommon] = await Promise.all([
    loadProfile(id),
    getTranslations("provider"),
    getTranslations("common"),
  ]);
  if (!profile) return {};

  const description =
    profile.bio?.slice(0, 160) ?? t("metaDescription", { name: profile.displayName });
  return {
    title: `${profile.displayName} | ${tCommon("brand")}`,
    description,
    openGraph: {
      title: profile.displayName,
      description,
      type: "profile",
    },
  };
}

export default async function ProviderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, actor] = await Promise.all([loadProfile(id), getActor()]);
  if (!profile) notFound();

  const [reviews, favorited, t, tCommon, tWeekdays, format, locale] = await Promise.all([
    listProviderReviews(profile.id),
    checkIsFavorited(actor, profile.id),
    getTranslations("provider"),
    getTranslations("common"),
    getTranslations("weekdays"),
    getFormatter(),
    getLocale(),
  ]);
  const priceUnitLabel = {
    job: tCommon("priceUnitJob"),
    hour: tCommon("priceUnitHour"),
    day: tCommon("priceUnitDay"),
  }[profile.priceUnit];

  const [avatarUrl, portfolio] = await Promise.all([
    getSignedImageUrl(profile.avatarKey),
    Promise.all(
      profile.portfolio.map(async (item) => ({
        ...item,
        url: await getSignedImageUrl(item.imageKey),
      })),
    ),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.displayName,
    description: profile.bio ?? undefined,
    image: avatarUrl ?? undefined,
    aggregateRating:
      profile.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: profile.ratingAvg,
            reviewCount: profile.ratingCount,
          }
        : undefined,
    geo:
      profile.latitude !== null && profile.longitude !== null
        ? { "@type": "GeoCoordinates", latitude: profile.latitude, longitude: profile.longitude }
        : undefined,
    url: `${env.APP_URL}/p/${profile.id}`,
  };

  const initial = profile.displayName.trim().charAt(0).toUpperCase() || "?";
  const sectionTitle = "mb-3 text-lg font-semibold";
  const card = "rounded-2xl border bg-card p-5 shadow-sm";
  const visiblePortfolio = portfolio.filter((item) => item.url);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Booking card: first on phones, a sticky right column on desktop. */}
        <aside className="lg:sticky lg:top-24 lg:order-2">
          <section className={`${card} flex flex-col gap-5`}>
            <div className="flex items-center gap-4">
              <Avatar className="size-20 shrink-0 shadow-md ring-2 ring-background">
                <AvatarImage src={avatarUrl ?? undefined} alt={profile.displayName} />
                <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start gap-1.5">
                  <h1 className="text-xl leading-tight font-bold">{profile.displayName}</h1>
                  {profile.isVerified ? (
                    <BadgeCheck className="text-primary mt-0.5 size-5 shrink-0" />
                  ) : null}
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Star className="size-4 fill-amber-500 text-amber-500" />
                  <span className="font-medium text-foreground">{profile.ratingAvg}</span>
                  <span>({t("reviewCount", { count: profile.ratingCount })})</span>
                </div>
                {profile.areaLabel ? (
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{profile.areaLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {profile.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.categories.map((category) => (
                  <span
                    key={category.slug}
                    className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    <CategoryIcon icon={category.icon} className="size-3.5" />
                    {categoryName(category, locale)}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-baseline gap-1 border-t pt-4">
              <span className="text-2xl font-bold">
                {format.number(Number(profile.basePrice))} {tCommon("currency")}
              </span>
              <span className="text-muted-foreground text-sm">/ {priceUnitLabel}</span>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                asChild
                className="h-12 w-full bg-brand-accent text-base text-brand-accent-foreground hover:bg-brand-accent/90"
              >
                <Link href={`/book/${profile.id}`}>{t("bookCta")}</Link>
              </Button>
              {actor && actor.role === "customer" && actor.id !== profile.id ? (
                <div className="grid grid-cols-2 gap-2 [&_button]:w-full [&_button]:max-w-none">
                  <StartChatButton providerId={profile.id} />
                  <FavoriteButton
                    providerId={profile.id}
                    initialFavorited={favorited}
                    variant="full"
                  />
                </div>
              ) : null}
            </div>
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {profile.bio ? (
            <section className={card}>
              <h2 className={sectionTitle}>{t("about")}</h2>
              <p className="text-muted-foreground whitespace-pre-line">{profile.bio}</p>
            </section>
          ) : null}

          {visiblePortfolio.length > 0 ? (
            <section className={card}>
              <h2 className={sectionTitle}>{t("portfolio")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visiblePortfolio.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square overflow-hidden rounded-xl bg-muted"
                  >
                    <Image
                      src={item.url!}
                      alt={item.caption ?? t("portfolio")}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-105"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {profile.availability.length > 0 ? (
            <section className={card}>
              <h2 className={sectionTitle}>{t("workingHours")}</h2>
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {profile.availability.map((a) => (
                  <div
                    key={a.weekday}
                    className="flex justify-between gap-4 border-b border-dashed pb-2"
                  >
                    <dt className="text-muted-foreground">{tWeekdays(String(a.weekday))}</dt>
                    <dd className="font-medium tabular-nums">
                      {a.startTime.slice(0, 5)} – {a.endTime.slice(0, 5)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {reviews.length > 0 ? (
            <section className={card}>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {t("reviewsTitle", { count: profile.ratingCount })}
                </h2>
                <span className="ml-auto flex items-center gap-1 text-sm font-medium">
                  <Star className="size-4 fill-amber-500 text-amber-500" />
                  {profile.ratingAvg}
                </span>
              </div>
              <ul className="flex flex-col divide-y">
                {reviews.map((review) => (
                  <li key={review.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {review.customerName.trim().charAt(0)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{review.customerName}</p>
                        <div className="flex" aria-label={`${review.rating}/5`}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`size-4 ${
                                i < review.rating
                                  ? "fill-amber-500 text-amber-500"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment ? (
                        <p className="text-muted-foreground text-sm whitespace-pre-line">
                          {review.comment}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.latitude !== null && profile.longitude !== null ? (
            <section className={card}>
              <h2 className={sectionTitle}>{t("serviceArea")}</h2>
              <ProviderMapLoader
                center={{ lat: profile.latitude, lng: profile.longitude }}
                markers={[
                  {
                    id: profile.id,
                    lat: profile.latitude,
                    lng: profile.longitude,
                    label: profile.displayName,
                  },
                ]}
                zoom={13}
              />
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
