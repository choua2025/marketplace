"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updatePersonalInfoAction } from "@/server/actions/profile";
import {
  FULL_NAME_MAX,
  FULL_NAME_MIN,
  LINE_ID_MAX,
  normalizePhone,
  PHONE_PATTERN,
} from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PersonalInfoFormProps {
  initialFullName: string;
  email: string;
  initialPhone: string | null;
  initialLineId: string | null;
  /** Who sees these contact details once a booking is accepted -- the note is worded for each side. */
  audience: "provider" | "customer";
}

export function PersonalInfoForm({
  initialFullName,
  email,
  initialPhone,
  initialLineId,
  audience,
}: PersonalInfoFormProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [lineId, setLineId] = useState(initialLineId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const nameLength = fullName.trim().length;
  const nameInvalid = nameLength < FULL_NAME_MIN || nameLength > FULL_NAME_MAX;
  const normalizedPhone = normalizePhone(phone);
  const phoneInvalid = normalizedPhone !== "" && !PHONE_PATTERN.test(normalizedPhone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nameInvalid || phoneInvalid) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updatePersonalInfoAction({ fullName, phone, lineId });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFullName(result.data.fullName);
    setPhone(result.data.phone ?? "");
    setLineId(result.data.lineId ?? "");
    setSaved(true);
    // The header's account menu shows the name too.
    router.refresh();
  }

  return (
    <form className="flex min-w-0 flex-1 flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
        <Input
          id="fullName"
          autoComplete="name"
          value={fullName}
          maxLength={FULL_NAME_MAX}
          onChange={(e) => {
            setFullName(e.target.value);
            setSaved(false);
          }}
          aria-invalid={nameInvalid || undefined}
          className="h-11"
        />
        {nameInvalid ? (
          <p className="text-xs text-destructive">
            {t("invalidFullName", { min: FULL_NAME_MIN, max: FULL_NAME_MAX })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <div className="relative">
          <Input id="email" value={email} readOnly disabled className="h-11 pr-9" />
          <Lock className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">{t("emailReadOnly")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactPhone">{t("phoneLabel")}</Label>
          <Input
            id="contactPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSaved(false);
            }}
            aria-invalid={phoneInvalid || undefined}
            className="h-11"
          />
          {phoneInvalid ? <p className="text-xs text-destructive">{t("invalidPhone")}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lineId">{t("lineIdLabel")}</Label>
          <Input
            id="lineId"
            placeholder={t("lineIdPlaceholder")}
            value={lineId}
            maxLength={LINE_ID_MAX}
            onChange={(e) => {
              setLineId(e.target.value);
              setSaved(false);
            }}
            className="h-11"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(audience === "provider" ? "contactNoteProvider" : "contactNoteCustomer")}
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" className="h-11" disabled={saving || nameInvalid || phoneInvalid}>
          {saving ? <Loader2 className="animate-spin" /> : t("savePersonalInfo")}
        </Button>
        {saved ? <span className="text-sm text-green-600">{tCommon("saved")}</span> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
