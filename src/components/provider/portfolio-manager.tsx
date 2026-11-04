"use client";

import { useRouter } from "@/i18n/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";
import {
  addPortfolioItemAction,
  removePortfolioItemAction,
} from "@/app/[locale]/(provider)/dashboard/profile/actions";
import { checkImageFile, maxUploadBytes, uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";

const MAX_PORTFOLIO_ITEMS = 30;
const MAX_MB = maxUploadBytes("portfolio") / (1024 * 1024);

interface PortfolioManagerProps {
  initialPortfolio: { id: string; url: string | null; caption: string | null }[];
}

export function PortfolioManager({ initialPortfolio }: PortfolioManagerProps) {
  const t = useTranslations("dashboard");
  const tAccount = useTranslations("account");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tProvider = useTranslations("provider");
  const router = useRouter();
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePortfolioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (portfolioInputRef.current) portfolioInputRef.current.value = "";
    if (!file) return;

    const problem = checkImageFile(file, "portfolio");
    if (problem) {
      setError(tAccount(problem, { maxMb: MAX_MB }));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const key = await uploadFile(file, "portfolio");
      const result = await addPortfolioItemAction(key);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "UPLOAD_FAILED"
          ? err.message
          : tErrors("UPLOAD_FAILED"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(itemId: string) {
    setBusy(true);
    setError(null);
    const result = await removePortfolioItemAction(itemId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">
          {t("gallery", { count: initialPortfolio.length, max: MAX_PORTFOLIO_ITEMS })}
        </h2>
        <span className="text-xs text-muted-foreground">
          {tAccount("imageHint", { maxMb: MAX_MB })}
        </span>
      </div>
      {initialPortfolio.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {initialPortfolio.map((item) =>
            item.url ? (
              <div key={item.id} className="relative aspect-square">
                <Image
                  src={item.url}
                  alt={item.caption ?? tProvider("portfolio")}
                  fill
                  className="rounded-md object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(item.id)}
                  className="bg-background/80 absolute top-1 right-1 rounded-full p-1"
                  aria-label={tCommon("removePhoto")}
                >
                  <Trash2 className="text-destructive size-4" />
                </button>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      <input
        ref={portfolioInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePortfolioChange}
      />
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={busy || initialPortfolio.length >= MAX_PORTFOLIO_ITEMS}
        onClick={() => portfolioInputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
        {t("addPortfolio")}
      </Button>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
