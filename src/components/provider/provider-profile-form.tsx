"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MapPin } from "lucide-react";
import { categoryName } from "@/lib/category-name";
import type { ProviderProfileDto } from "@/server/services/provider";
import type { CategoryDto } from "@/server/services/category";
import {
  setProviderCategoriesAction,
  updateProviderProfileAction,
} from "@/app/[locale]/(provider)/dashboard/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProviderProfileFormProps {
  initialProfile: ProviderProfileDto;
  initialCategorySlugs: string[];
  allCategories: CategoryDto[];
}

export function ProviderProfileForm({
  initialProfile,
  initialCategorySlugs,
  allCategories,
}: ProviderProfileFormProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [bio, setBio] = useState(initialProfile.bio ?? "");
  const [basePrice, setBasePrice] = useState(initialProfile.basePrice);
  const [priceUnit, setPriceUnit] = useState(initialProfile.priceUnit);
  const [areaLabel, setAreaLabel] = useState(initialProfile.areaLabel ?? "");
  const [latitude, setLatitude] = useState(initialProfile.latitude ?? "");
  const [longitude, setLongitude] = useState(initialProfile.longitude ?? "");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(initialProfile.serviceRadiusKm);
  const [isActive, setIsActive] = useState(initialProfile.isActive);
  const [categorySlugs, setCategorySlugs] = useState<string[]>(initialCategorySlugs);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    });
  }

  function toggleCategory(slug: string) {
    setCategorySlugs((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );
  }

  async function handleSave() {
    setError(null);
    setSaving(true);

    const profileResult = await updateProviderProfileAction({
      displayName,
      bio,
      basePrice: Number(basePrice),
      priceUnit,
      areaLabel,
      latitude: latitude === "" ? undefined : Number(latitude),
      longitude: longitude === "" ? undefined : Number(longitude),
      serviceRadiusKm,
      isActive,
    });

    if (!profileResult.ok) {
      setSaving(false);
      setError(profileResult.error);
      return;
    }

    const categoriesResult = await setProviderCategoriesAction({ categorySlugs });
    setSaving(false);

    if (!categoriesResult.ok) {
      setError(categoriesResult.error);
      return;
    }

    setSavedAt(Date.now());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">{t("shopName")}</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">{t("bio")}</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="basePrice">{t("basePrice", { currency: tCommon("currency") })}</Label>
          <Input
            id="basePrice"
            type="number"
            min={0}
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className="h-12"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priceUnit">{t("priceUnit")}</Label>
          <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v as typeof priceUnit)}>
            <SelectTrigger id="priceUnit" className="h-12 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="job">{tCommon("priceUnitJob")}</SelectItem>
              <SelectItem value="hour">{tCommon("priceUnitHour")}</SelectItem>
              <SelectItem value="day">{tCommon("priceUnitDay")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="areaLabel">{t("areaLabel")}</Label>
        <Input
          id="areaLabel"
          value={areaLabel}
          onChange={(e) => setAreaLabel(e.target.value)}
          placeholder={t("areaPlaceholder")}
          className="h-12"
        />
        <Button type="button" variant="outline" className="h-10 w-fit" onClick={useCurrentLocation}>
          <MapPin className="size-4" /> {t("useCurrentLocation")}
        </Button>
        {latitude && longitude ? (
          <p className="text-muted-foreground text-xs">
            {t("coordinates", { lat: latitude, lng: longitude })}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{t("noCoordinates")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="serviceRadiusKm">{t("serviceRadius")}</Label>
        <Input
          id="serviceRadiusKm"
          type="number"
          min={1}
          max={200}
          value={serviceRadiusKm}
          onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
          className="h-12"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="isActive">{t("isActive")}</Label>
        <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("categories")}</legend>
        {allCategories.map((category) => (
          <label key={category.slug} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={categorySlugs.includes(category.slug)}
              onCheckedChange={() => toggleCategory(category.slug)}
            />
            {categoryName(category, locale)}
          </label>
        ))}
      </fieldset>

      <Button type="button" className="h-12" disabled={saving} onClick={handleSave}>
        {saving ? <Loader2 className="animate-spin" /> : t("saveProfile")}
      </Button>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {savedAt ? <p className="text-sm text-green-600">{tCommon("saved")}</p> : null}
    </div>
  );
}
