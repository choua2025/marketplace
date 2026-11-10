import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { BadgeCheck, BriefcaseBusiness, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SearchResultWithAvatarDto } from "@/app/[locale]/(public)/search/actions";
import { FavoriteButton } from "@/components/provider/favorite-button";
import { hueFromString, nameInitial } from "@/lib/avatar-initial";

interface ProviderCardProps {
  provider: SearchResultWithAvatarDto;
  canFavorite?: boolean;
  /** False where the results aren't relative to a location (e.g. the homepage). */
  showDistance?: boolean;
}

export function ProviderCard({
  provider,
  canFavorite = false,
  showDistance = true,
}: ProviderCardProps) {
  const t = useTranslations("common");
  const initial = nameInitial(provider.displayName);
  // Stable per-provider tint so photo-less cards are distinguishable, not identical grey boxes.
  const hue = hueFromString(provider.id);
  const priceUnitLabel =
    provider.priceUnit === "hour"
      ? t("priceUnitHour")
      : provider.priceUnit === "day"
        ? t("priceUnitDay")
        : t("priceUnitJob");

  return (
    <Link
      href={`/p/${provider.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative m-3 mb-0 aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        {provider.avatarUrl ? (
          <Image
            src={provider.avatarUrl}
            alt={provider.displayName}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 70% 92%), hsl(${(hue + 40) % 360} 70% 82%))`,
            }}
          >
            <span
              className="flex size-20 items-center justify-center rounded-full bg-background/80 text-3xl font-semibold shadow-sm"
              style={{ color: `hsl(${hue} 55% 35%)` }}
            >
              {initial}
            </span>
          </div>
        )}
        {canFavorite ? (
          <div className="absolute top-2 right-2">
            <FavoriteButton providerId={provider.id} initialFavorited={provider.isFavorited} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-4">
        <div className="flex items-center gap-1">
          <span className="truncate font-semibold">{provider.displayName}</span>
          {provider.isVerified ? <BadgeCheck className="size-4 shrink-0 text-primary" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
          <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden />
          <span className="font-medium">{Number(provider.ratingAvg).toFixed(1)}</span>
          <span className="text-muted-foreground">
            ({t("reviewsCount", { count: provider.ratingCount })})
          </span>
          {provider.completedJobs > 0 ? (
            <span className="text-xs text-muted-foreground">
              · {t("jobsDone", { count: provider.completedJobs })}
            </span>
          ) : null}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {provider.areaLabel ??
            (showDistance ? `${provider.distanceKm.toFixed(1)} ${t("km")}` : " ")}
        </span>
        {provider.experienceYears !== null ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <BriefcaseBusiness className="size-3.5 shrink-0" aria-hidden />
            {t("experience", { count: provider.experienceYears })}
          </span>
        ) : null}
        <div className="mt-auto flex items-baseline gap-1.5 pt-2">
          <span className="text-lg font-semibold text-primary">
            {Number(provider.basePrice).toLocaleString()} {t("currency")}
          </span>
          <span className="text-xs text-muted-foreground">{priceUnitLabel}</span>
        </div>
        {/* The whole card is the link; this only looks like a button. */}
        <span
          aria-hidden
          className="mt-1 inline-flex h-9 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors group-hover:bg-primary/90"
        >
          {t("viewDetails")}
        </span>
      </div>
    </Link>
  );
}
