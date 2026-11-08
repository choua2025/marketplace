"use client";

import { useRouter } from "@/i18n/navigation";
import { useMemo, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Loader2, Upload, X } from "lucide-react";
import { createBookingAction } from "@/app/[locale]/(customer)/book/[providerId]/actions";
import { uploadFile } from "@/lib/upload-client";
import { categoryName } from "@/lib/category-name";
import { bookingTimeProblem, type BookingTimeProblem } from "@/lib/validations/booking";
import { billableHours } from "@/lib/booking-hours";
import type { BusyRange, WorkingHoursRule } from "@/lib/booking-slots";
import { BookingTimePicker } from "@/components/booking/booking-time-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CategoryIcon } from "@/components/category-icon";

const MAX_PHOTOS = 5;
// Same minimums as createBookingSchema (src/lib/validations/booking.ts).
const MIN_DESCRIPTION = 10;
const MIN_ADDRESS = 5;

interface BookingFormProps {
  providerId: string;
  categories: { slug: string; nameTh: string; nameEn: string; icon: string }[];
  basePrice: string;
  priceUnit: "job" | "hour" | "day";
  /** Weekly working hours; only times inside them can be picked. */
  availability: WorkingHoursRule[];
  timezone: string;
  /** Time the provider has already confirmed (see BookingTimePicker). */
  busy: BusyRange[];
  /** Server time when the page was rendered (see BookingTimePicker). */
  now: number;
}

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {step}
      </span>
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}

export function BookingForm({
  providerId,
  categories,
  basePrice,
  priceUnit,
  availability,
  timezone,
  busy,
  now,
}: BookingFormProps) {
  const t = useTranslations("booking");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug) ?? categories[0],
    [categories, categorySlug],
  );

  const priceUnitLabel = {
    job: tCommon("priceUnitJob"),
    hour: tCommon("priceUnitHour"),
    day: tCommon("priceUnitDay"),
  }[priceUnit];
  const price = `${format.number(Number(basePrice))} ${tCommon("currency")}`;

  function formatDateTime(value: string) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    // On the provider's clock, like the time picker.
    return format.dateTime(date, { dateStyle: "medium", timeStyle: "short", timeZone: timezone });
  }

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const key = await uploadFile(file, "booking");
      setPhotoKeys((keys) => [...keys, key]);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "UPLOAD_FAILED"
          ? err.message
          : tErrors("UPLOAD_FAILED"),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(key: string) {
    setPhotoKeys((keys) => keys.filter((k) => k !== key));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = await createBookingAction({
      providerId,
      categorySlug,
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      description,
      address,
      photoKeys,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/bookings/${result.data.id}`);
  }

  const descriptionLength = description.trim().length;
  const addressLength = address.trim().length;

  // Same rules the server enforces. With only a start picked, check just the
  // start (a 1 ms end is always a valid range).
  const startDate = startAt ? new Date(startAt) : null;
  const endDate = endAt ? new Date(endAt) : null;
  const timeProblem = startDate
    ? bookingTimeProblem(startDate, endDate ?? new Date(startDate.getTime() + 1))
    : null;
  const timeProblemMessage: Record<BookingTimeProblem, string> = {
    startTooSoon: t("timeStartTooSoon"),
    startTooFar: t("timeStartTooFar"),
    endBeforeStart: t("timeEndBeforeStart"),
    tooLong: t("timeTooLong"),
  };

  // Hourly pros: show how many hours are booked and the estimated total.
  const hours =
    priceUnit === "hour" && startDate && endDate && !timeProblem
      ? billableHours(startDate, endDate)
      : null;
  const estimatedTotal =
    hours === null
      ? null
      : `${format.number(Number(basePrice) * hours)} ${tCommon("currency")}`;

  const canSubmit =
    !submitting &&
    !!startAt &&
    !!endAt &&
    !timeProblem &&
    descriptionLength >= MIN_DESCRIPTION &&
    addressLength >= MIN_ADDRESS;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      {/* min-w-0: the scrolling row of day buttons must not widen the page. */}
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <StepHeading step={1} title={t("step1")} />
          <RadioGroup
            value={categorySlug}
            onValueChange={setCategorySlug}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {categories.map((c) => (
              <label
                key={c.slug}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors",
                  "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5",
                )}
              >
                <RadioGroupItem value={c.slug} className="sr-only" />
                <span className="flex items-center gap-1.5 font-medium">
                  <CategoryIcon icon={c.icon} className="size-4 text-primary" />
                  {categoryName(c, locale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("startingFrom", { price })} / {priceUnitLabel}
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <StepHeading step={2} title={t("step2")} />
          <BookingTimePicker
            rules={availability}
            timezone={timezone}
            busy={busy}
            now={now}
            onChange={(nextStart, nextEnd) => {
              setStartAt(nextStart);
              setEndAt(nextEnd);
            }}
          />
          {/* Only if the page was left open long enough for the picked time to pass. */}
          {timeProblem ? (
            <p role="alert" className="text-sm text-destructive">
              {timeProblemMessage[timeProblem]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          <StepHeading step={3} title={t("step3")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{t("descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t("descriptionPlaceholder")}
              aria-describedby="description-hint"
            />
            {descriptionLength > 0 && descriptionLength < MIN_DESCRIPTION ? (
              <p id="description-hint" className="text-xs text-destructive">
                {t("minChars", { min: MIN_DESCRIPTION, count: descriptionLength })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">{t("addressLabel")}</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder={t("addressPlaceholder")}
              aria-describedby="address-hint"
            />
            {addressLength > 0 && addressLength < MIN_ADDRESS ? (
              <p id="address-hint" className="text-xs text-destructive">
                {t("minChars", { min: MIN_ADDRESS, count: addressLength })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("photosLabel", { max: MAX_PHOTOS })}</Label>
            <div className="flex flex-wrap gap-2">
              {photoKeys.map((key) => (
                <div
                  key={key}
                  className="bg-muted flex items-center gap-1 rounded px-2 py-1 text-xs"
                >
                  <span className="max-w-32 truncate">{key.split("/").pop()}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(key)}
                    aria-label={tCommon("removePhoto")}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAddPhoto}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading || photoKeys.length >= MAX_PHOTOS}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
              {t("addPhoto")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:sticky lg:top-20">
        <h2 className="font-semibold">{t("summaryTitle")}</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t("summaryService")}</dt>
            <dd className="truncate font-medium">
              {selectedCategory ? categoryName(selectedCategory, locale) : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t("summaryStart")}</dt>
            <dd className="text-right font-medium">{formatDateTime(startAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t("summaryEnd")}</dt>
            <dd className="text-right font-medium">{formatDateTime(endAt)}</dd>
          </div>
          {hours !== null ? (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t("summaryDuration")}</dt>
              <dd className="text-right font-medium">{t("durationHours", { count: hours })}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">{t("summaryStartingPrice")}</span>
          <span className={cn("font-bold", estimatedTotal ? "text-sm" : "text-lg")}>
            {price}
            <span className="text-sm font-normal text-muted-foreground"> / {priceUnitLabel}</span>
          </span>
        </div>

        {hours !== null && estimatedTotal ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {t("summaryEstimatedTotal")}
              <span className="block text-xs">
                {t("estimateBreakdown", { price, count: hours })}
              </span>
            </span>
            <span className="text-lg font-bold">{estimatedTotal}</span>
          </div>
        ) : null}

        <Button
          type="button"
          className="h-12 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? <Loader2 className="animate-spin" /> : t("confirm")}
        </Button>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <p className="text-xs text-muted-foreground">{t("priceNote")}</p>
      </div>
    </div>
  );
}
