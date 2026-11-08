"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setShowOnHomepageAction } from "@/server/actions/profile";
import { Switch } from "@/components/ui/switch";

/** Opt-in for showing the customer's profile photo on the public homepage. Saves on toggle. */
export function HomepagePhotoToggle({ initialValue }: { initialValue: boolean }) {
  const t = useTranslations("account");
  const [checked, setChecked] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    setChecked(next);
    setSaving(true);
    setError(null);
    const result = await setShowOnHomepageAction(next);
    setSaving(false);
    if (!result.ok) {
      setChecked(!next);
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="showOnHomepage" className="text-sm font-medium">
            {t("showOnHomepageLabel")}
          </label>
          <p className="text-xs text-muted-foreground">{t("showOnHomepageHint")}</p>
        </div>
        <Switch
          id="showOnHomepage"
          checked={checked}
          disabled={saving}
          onCheckedChange={handleChange}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
