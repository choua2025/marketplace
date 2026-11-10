"use client";

import { useEffect, useState } from "react";
import {
  List,
  Loader2,
  LocateFixed,
  MapIcon,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CategoryDto } from "@/server/services/category";
import {
  searchProvidersAction,
  type SearchResultWithAvatarDto,
} from "@/app/[locale]/(public)/search/actions";
import type { SearchSort } from "@/lib/validations/search";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
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
type Area = DefaultArea | "mine";

const DISTANCE_OPTIONS = [5, 10, 25, 50, 200] as const;
const PRICE_RANGES = [
  { id: "0-500", max: 500 },
  { id: "500-1000", min: 500, max: 1000 },
  { id: "1000-2000", min: 1000, max: 2000 },
  { id: "2000-5000", min: 2000, max: 5000 },
  { id: "5000+", min: 5000 },
] as const satisfies { id: string; min?: number; max?: number }[];
const SORTS: { value: SearchSort; label: string }[] = [
  { value: "recommended", label: "sortRecommended" },
  { value: "mostBooked", label: "sortMostBooked" },
  { value: "rating", label: "sortRating" },
  { value: "newest", label: "sortNewest" },
  { value: "distance", label: "sortDistance" },
  { value: "price", label: "sortPrice" },
];
/** Wait this long after the last keystroke before searching. */
const TYPING_DELAY_MS = 350;

const OPTION_ROW =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm transition-colors hover:text-primary has-[[data-state=checked]]:font-medium has-[[data-state=checked]]:text-primary";

interface SearchClientProps {
  allCategories: CategoryDto[];
  initialCategorySlug?: string;
  initialQuery?: string;
}

export function SearchClient({
  allCategories,
  initialCategorySlug,
  initialQuery,
}: SearchClientProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  // Categories only have Thai/English names in the DB -- Lao falls back to
  // English until a Lao column exists.
  const categoryName = (category: CategoryDto) =>
    locale === "th" ? category.nameTh : category.nameEn;
  const money = (amount: number) => `${amount.toLocaleString()} ${tCommon("currency")}`;
  const priceLabel = (range: (typeof PRICE_RANGES)[number]) =>
    !("min" in range)
      ? t("priceUpTo", { max: money(range.max) })
      : !("max" in range)
        ? t("priceFrom", { min: money(range.min) })
        : t("priceBetween", { min: range.min.toLocaleString(), max: money(range.max) });

  // Starts at a default city immediately, no permission prompt on load --
  // asking for geolocation before the user has done anything is a
  // Lighthouse best-practices violation and bad UX besides. Picking "near my
  // location" requests it only on explicit user action.
  const defaultArea: DefaultArea = locale === "lo" ? "vientiane" : "bangkok";
  const [area, setArea] = useState<Area>(defaultArea);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const location =
    area === "mine" && myLocation
      ? myLocation
      : DEFAULT_AREAS[area === "mine" ? defaultArea : area];
  const areaName = (a: DefaultArea) => t(a === "vientiane" ? "areaVientiane" : "areaBangkok");

  const [query, setQuery] = useState(initialQuery ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const [category, setCategory] = useState(initialCategorySlug ?? "any");
  const [priceRange, setPriceRange] = useState("any");
  const [minRating, setMinRating] = useState("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxKm, setMaxKm] = useState("25");
  const [sort, setSort] = useState<SearchSort>("recommended");
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [results, setResults] = useState<SearchResultWithAvatarDto[]>([]);
  const [canFavorite, setCanFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = allCategories.find((c) => c.slug === category);
  const selectedPrice = PRICE_RANGES.find((r) => r.id === priceRange);

  function locateMe() {
    setLocationFailed(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationFailed(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setArea("mine");
      },
      () => {
        setLocating(false);
        setLocationFailed(true);
      },
      { timeout: 10000 },
    );
  }

  function changeArea(next: string) {
    // "Near me" needs the browser's permission first; the area only switches once we have it.
    if (next === "mine") locateMe();
    else setArea(next as DefaultArea);
  }

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setCategory("any");
    setPriceRange("any");
    setMinRating("any");
    setVerifiedOnly(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { lat, lng } = location;
  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      setLoading(true);
      setError(null);

      const price = PRICE_RANGES.find((r) => r.id === priceRange);
      const result = await searchProvidersAction({
        lat,
        lng,
        q: debouncedQuery || undefined,
        maxKm: Number(maxKm),
        sort,
        categorySlug: category === "any" ? undefined : category,
        minRating: minRating === "any" ? undefined : Number(minRating),
        minPrice: price && "min" in price ? price.min : undefined,
        maxPrice: price && "max" in price ? price.max : undefined,
        verifiedOnly: verifiedOnly || undefined,
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
  }, [lat, lng, debouncedQuery, category, sort, minRating, priceRange, verifiedOnly, maxKm]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (debouncedQuery) {
    activeFilters.push({
      key: "q",
      label: `“${debouncedQuery}”`,
      clear: () => {
        setQuery("");
        setDebouncedQuery("");
      },
    });
  }
  if (selectedCategory) {
    activeFilters.push({
      key: "category",
      label: categoryName(selectedCategory),
      clear: () => setCategory("any"),
    });
  }
  if (selectedPrice) {
    activeFilters.push({
      key: "price",
      label: priceLabel(selectedPrice),
      clear: () => setPriceRange("any"),
    });
  }
  if (minRating !== "any") {
    activeFilters.push({
      key: "rating",
      label: t("ratingChip", { rating: minRating }),
      clear: () => setMinRating("any"),
    });
  }
  if (verifiedOnly) {
    activeFilters.push({
      key: "verified",
      label: t("verifiedChip"),
      clear: () => setVerifiedOnly(false),
    });
  }

  return (
    // On desktop the page is a fixed-height frame: filters and the toolbar
    // stay put and only the results area scrolls. Mobile scrolls normally.
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-6">
      <Button
        type="button"
        variant="outline"
        className="w-fit lg:hidden"
        aria-expanded={filtersOpen}
        aria-controls="search-filters"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        <SlidersHorizontal className="size-4" />
        {filtersOpen ? t("hideFilters") : t("showFilters")}
        {activeFilters.length > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {activeFilters.length}
          </span>
        ) : null}
      </Button>

      <aside
        id="search-filters"
        className={cn(
          "w-full shrink-0 flex-col gap-6 rounded-xl border bg-card p-5 lg:flex lg:max-h-full lg:w-64 lg:self-start lg:overflow-y-auto",
          filtersOpen ? "flex" : "hidden",
        )}
      >
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold">{t("filtersTitle")}</h2>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
            {t("verifiedOnly")}
          </label>
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 font-semibold">{t("categoryLabel")}</legend>
          <RadioGroup value={category} onValueChange={setCategory} className="gap-0">
            <label className={OPTION_ROW}>
              <RadioGroupItem value="any" />
              {t("allCategories")}
            </label>
            {allCategories.map((c) => (
              <label key={c.slug} className={OPTION_ROW}>
                <RadioGroupItem value={c.slug} />
                {categoryName(c)}
              </label>
            ))}
          </RadioGroup>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 font-semibold">{t("priceTitle")}</legend>
          <RadioGroup value={priceRange} onValueChange={setPriceRange} className="gap-0">
            <label className={OPTION_ROW}>
              <RadioGroupItem value="any" />
              {t("anyPrice")}
            </label>
            {PRICE_RANGES.map((range) => (
              <label key={range.id} className={OPTION_ROW}>
                <RadioGroupItem value={range.id} />
                {priceLabel(range)}
              </label>
            ))}
          </RadioGroup>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="minRating" className="font-semibold">
            {t("minRatingLabel")}
          </Label>
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
          <Label htmlFor="area" className="font-semibold">
            {t("locationTitle")}
          </Label>
          <Select value={area} onValueChange={changeArea} disabled={locating}>
            <SelectTrigger id="area" className="h-10 w-full">
              {locating ? <Loader2 className="size-4 animate-spin" /> : null}
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">
                <LocateFixed className="size-4" />
                {t("locationMine")}
              </SelectItem>
              <SelectItem value="bangkok">{areaName("bangkok")}</SelectItem>
              <SelectItem value="vientiane">{areaName("vientiane")}</SelectItem>
            </SelectContent>
          </Select>
          {locationFailed ? (
            <p role="alert" className="text-xs text-destructive">
              {t("locationFailed")}
            </p>
          ) : null}
          <Select value={maxKm} onValueChange={setMaxKm}>
            <SelectTrigger className="h-10 w-full" aria-label={t("maxDistanceLabel")}>
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              maxLength={100}
              className="h-10 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{t("sortLabel")}</span>
            <Select value={sort} onValueChange={(value) => setSort(value as SearchSort)}>
              <SelectTrigger className="h-10 w-44" aria-label={t("sortLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
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

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <span className="text-sm text-muted-foreground">{t("activeFilters")}</span>
            {activeFilters.map((filter) => (
              <span
                key={filter.key}
                className="inline-flex items-center gap-1 rounded-md border bg-background py-1 pr-1 pl-2.5 text-sm"
              >
                {filter.label}
                <button
                  type="button"
                  onClick={filter.clear}
                  aria-label={t("removeFilter", { label: filter.label })}
                  className="flex size-5 items-center justify-center rounded text-primary hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-sm font-medium text-primary hover:underline"
            >
              {t("clearAll")}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-bold">
            {selectedCategory ? categoryName(selectedCategory) : t("headingAll")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "…" : t("resultsCount", { count: results.length })}
            {" · "}
            {area === "mine" ? t("nearYou") : t("nearArea", { area: areaName(area) })}
          </p>
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
            area === "mine" ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
            ) : (
              // Still searching a default city: the visitor may simply be elsewhere.
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  {t("emptyStateDefaultArea", { area: areaName(area) })}
                </p>
                <Button type="button" disabled={locating} onClick={locateMe}>
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
