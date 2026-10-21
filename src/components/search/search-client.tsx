"use client";

import { useEffect, useState } from "react";
import { List, Loader2, LocateFixed, MapIcon } from "lucide-react";
import type { CategoryDto } from "@/server/services/category";
import type { SearchResultDto } from "@/server/services/search";
import { searchProvidersAction } from "@/app/[locale]/(public)/search/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderMapLoader } from "@/components/map/provider-map-loader";
import { ProviderCard } from "@/components/search/provider-card";

const BANGKOK_CENTER = { lat: 13.7563, lng: 100.5018 };

interface SearchClientProps {
  allCategories: CategoryDto[];
  initialCategorySlug?: string;
}

export function SearchClient({ allCategories, initialCategorySlug }: SearchClientProps) {
  // Defaults to Bangkok immediately, no permission prompt on load --
  // asking for geolocation before the user has done anything is a
  // Lighthouse best-practices violation and bad UX besides. "ใช้ตำแหน่ง
  // ของฉัน" below requests it only on explicit user action.
  const [location, setLocation] = useState(BANGKOK_CENTER);
  const [locating, setLocating] = useState(false);
  const [category, setCategory] = useState(initialCategorySlug ?? "any");
  const [sort, setSort] = useState("recommended");
  const [minRating, setMinRating] = useState("any");
  const [maxKm, setMaxKm] = useState("25");
  const [view, setView] = useState<"list" | "map">("list");

  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setLocating(false),
      { timeout: 5000 },
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
      });

      if (cancelled) return;
      setLoading(false);
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
  }, [location, category, sort, minRating, maxKm]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 w-full" aria-label="หมวดงาน">
            <SelectValue placeholder="หมวดงาน" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">ทุกหมวด</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.nameTh}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-11 w-full" aria-label="เรียงตาม">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">แนะนำ</SelectItem>
            <SelectItem value="distance">ใกล้ที่สุด</SelectItem>
            <SelectItem value="rating">คะแนนสูงสุด</SelectItem>
            <SelectItem value="price">ราคาต่ำสุด</SelectItem>
          </SelectContent>
        </Select>

        <Select value={minRating} onValueChange={setMinRating}>
          <SelectTrigger className="h-11 w-full" aria-label="คะแนนขั้นต่ำ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">ทุกคะแนน</SelectItem>
            <SelectItem value="3">3+ ดาว</SelectItem>
            <SelectItem value="4">4+ ดาว</SelectItem>
            <SelectItem value="4.5">4.5+ ดาว</SelectItem>
          </SelectContent>
        </Select>

        <Select value={maxKm} onValueChange={setMaxKm}>
          <SelectTrigger className="h-11 w-full" aria-label="ระยะทางสูงสุด">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">ภายใน 5 กม.</SelectItem>
            <SelectItem value="10">ภายใน 10 กม.</SelectItem>
            <SelectItem value="25">ภายใน 25 กม.</SelectItem>
            <SelectItem value="50">ภายใน 50 กม.</SelectItem>
            <SelectItem value="200">ภายใน 200 กม.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={view === "list" ? "default" : "outline"}
          onClick={() => setView("list")}
        >
          <List className="size-4" /> รายการ
        </Button>
        <Button
          type="button"
          variant={view === "map" ? "default" : "outline"}
          onClick={() => setView("map")}
        >
          <MapIcon className="size-4" /> แผนที่
        </Button>
        <Button type="button" variant="outline" disabled={locating} onClick={useMyLocation}>
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          ใช้ตำแหน่งของฉัน
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          ไม่พบช่างที่ตรงกับเงื่อนไข ลองขยายระยะทางหรือเปลี่ยนหมวดงาน
        </p>
      ) : view === "list" ? (
        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <ProviderCard key={r.id} provider={r} />
          ))}
        </div>
      ) : (
        <ProviderMapLoader
          center={location}
          markers={results.map((r) => ({
            id: r.id,
            lat: r.latitude,
            lng: r.longitude,
            label: r.displayName,
          }))}
        />
      )}
    </div>
  );
}
