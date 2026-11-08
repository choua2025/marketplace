"use client";

import { useEffect, useState } from "react";
import { List, Loader2, LocateFixed, MapIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CategoryDto } from "@/server/services/category";
import {
  searchProvidersAction,
  type SearchResultWithAvatarDto,
} from "@/app/[locale]/(public)/search/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderMapLoader } from "@/components/map/provider-map-loader";
import { ProviderCard } from "@/components/search/provider-card";

/**
 * Where search starts before the visitor shares their location: the capital
 * of the country the site language points to.
 */
const DEFAULT_AREAS = {
  bangkok: { lat: 13.7563, lng: 100.5018 },
  vientiane: { lat: 17.9757, lng: 102.6331 },
} as const;
type DefaultArea = keyof typeof DEFAULT_AREAS;
const DISTANCE_OPTIONS = [5, 10, 25, 50, 200] as const;
const PRICE_OPTIONS = [500, 1000, 2000, 5000, 10000] as const;

interface SearchClientProps {
  allCategories: CategoryDto[];
  initialCategorySlug?: string;
}

export function SearchClient({ allCategories, initialCategorySlug }: SearchClientProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  // Categories only have Thai/English names in the DB -- Lao falls back to
  // English until a Lao column exists.
  const categoryName = (category: CategoryDto) =>
    locale === "th" ? category.nameTh : category.nameEn;

  // Starts at a default city immediately, no permission prompt on load --
  // asking for geolocation before the user has done anything is a
  // Lighthouse best-practices violation and bad UX besides. "Use my
  // location" below requests it only on explicit user action.
  const defaultArea: DefaultArea = locale === "lo" ? "vientiane" : "bangkok";
  const [location, setLocation] = useState<{ lat: number; lng: number }>(
    DEFAULT_AREAS[defaultArea],
  );
  const [usingMyLocation, setUsingMyLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const areaName = t(defaultArea === "vientiane" ? "areaVientiane" : "areaBangkok");
  const [category, setCategory] = useState(initialCategorySlug ?? "any");
  const [sort, setSort] = useState("recommended");
  const [minRating, setMinRating] = useState("any");
  const [maxPrice, setMaxPrice] = useState("any");
  const [maxKm, setMaxKm] = useState("25");
  const [view, setView] = useState<"list" | "map">("list");

  const [results, setResults] = useState<SearchResultWithAvatarDto[]>([]);
  const [canFavorite, setCanFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    setLocationFailed(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationFailed(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setUsingMyLocation(true);
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationFailed(true);
      },
      { timeout: 10000 },
    );
  }

  useEffect(() => {
    const { lat, lng } = location;

    let cancelled = false;

    async function runSearch() {
      setLoading(true);
      setError(null);

      const result = await searchProvidersAction({
        lat,
        lng,
        maxKm: Number(maxKm),
        sort,
        categorySlug: category === "any" ? undefined : category,
        minRating: minRating === "any" ? undefined : Number(minRating),
        maxPrice: maxPrice === "any" ? undefined : Number(maxPrice),
      });

      if (cancelled) return;
      setLoading(false);
      setCanFavorite(result.canFavorite);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResults(result.data);
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [location, category, sort, minRating, maxPrice, maxKm]);

  return (
    // On desktop the page is a fixed-height frame: filters and the toolbar
    // stay put and only the results area scrolls. Mobile scrolls normally.
    <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 rounded-xl border bg-card p-4 lg:max-h-full lg:w-64 lg:self-start lg:overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("filtersTitle")}</h2>
          <RadioGroup value={category} onValueChange={setCategory} className="flex flex-col gap-1">
            <label
              className={cn(
                "flex cursor-pointer items-center rounded-lg px-2.5 py-2 text-sm transition-colors",
                "hover:bg-muted has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:font-medium has-[[data-state=checked]]:text-primary",
              )}
            >
              <RadioGroupItem value="any" className="sr-only" />
              {t("allCategories")}
            </label>
            {allCategories.map((c) => (
              <label
                key={c.slug}
                className={cn(
                  "flex cursor-pointer items-center rounded-lg px-2.5 py-2 text-sm transition-colors",
                  "hover:bg-muted has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:font-medium has-[[data-state=checked]]:text-primary",
                )}
              >
                <RadioGroupItem value={c.slug} className="sr-only" />
                {categoryName(c)}
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="minRating">{t("minRatingLabel")}</Label>
          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger id="minRating" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyRating")}</SelectItem>
              <SelectItem value="3">3+ ★</SelectItem>
              <SelectItem value="4">4+ ★</SelectItem>
              <SelectItem value="4.5">4.5+ ★</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="maxPrice">{t("maxPriceLabel")}</Label>
          <Select value={maxPrice} onValueChange={setMaxPrice}>
            <SelectTrigger id="maxPrice" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyPrice")}</SelectItem>
              {PRICE_OPTIONS.map((price) => (
                <SelectItem key={price} value={String(price)}>
                  ≤ {price.toLocaleString()} {tCommon("currency")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="maxKm">{t("maxDistanceLabel")}</Label>
          <Select value={maxKm} onValueChange={setMaxKm}>
            <SelectTrigger id="maxKm" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_OPTIONS.map((km) => (
                <SelectItem key={km} value={String(km)}>
                  {t("withinKm", { km })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" disabled={locating} onClick={useMyLocation}>
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          {t("useMyLocation")}
        </Button>
        {locationFailed ? (
          <p role="alert" className="text-xs text-destructive">
            {t("locationFailed")}
          </p>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {loading ? "…" : t("resultsCount", { count: results.length })}
            {" · "}
            {usingMyLocation ? t("nearYou") : t("nearArea", { area: areaName })}
          </p>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9 w-full" aria-label={t("sortLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">{t("sortRecommended")}</SelectItem>
                <SelectItem value="distance">{t("sortDistance")}</SelectItem>
                <SelectItem value="rating">{t("sortRating")}</SelectItem>
                <SelectItem value="price">{t("sortPrice")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
              <button
                type="button"
                aria-label={t("viewList")}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("viewMap")}
                aria-pressed={view === "map"}
                onClick={() => setView("map")}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  view === "map"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <MapIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* The only scrolling area on desktop. Padding keeps card hover shadows from being clipped. */}
        <div
          data-testid="search-results"
          className="lg:-m-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-1 lg:pb-4"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : results.length === 0 ? (
            usingMyLocation ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
            ) : (
              // Still searching the default city: the visitor may simply be elsewhere.
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  {t("emptyStateDefaultArea", { area: areaName })}
                </p>
                <Button type="button" disabled={locating} onClick={useMyLocation}>
                  {locating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LocateFixed className="size-4" />
                  )}
                  {t("useMyLocation")}
                </Button>
              </div>
            )
          ) : view === "list" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => (
                <ProviderCard key={r.id} provider={r} canFavorite={canFavorite} />
              ))}
            </div>
          ) : (
            <ProviderMapLoader
              center={location}
              heightClassName="h-80 lg:h-full"
              markers={results.map((r) => ({
                id: r.id,
                lat: r.latitude,
                lng: r.longitude,
                label: r.displayName,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
