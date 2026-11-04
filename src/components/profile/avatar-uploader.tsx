"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { confirmAvatarUploadAction } from "@/server/actions/profile";
import { checkImageFile, maxUploadBytes, uploadFile } from "@/lib/upload-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const MAX_MB = maxUploadBytes("avatar") / (1024 * 1024);

export function AvatarUploader({
  avatarUrl,
  fullName,
}: {
  avatarUrl: string | null;
  fullName: string;
}) {
  const t = useTranslations("account");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Local preview so the new photo shows immediately, before the page refresh
  // brings back the stored (signed) URL.
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    const problem = checkImageFile(file, "avatar");
    if (problem) {
      setError(t(problem, { maxMb: MAX_MB }));
      return;
    }

    setError(null);
    setBusy(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      const key = await uploadFile(file, "avatar");
      const result = await confirmAvatarUploadAction(key);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setPreview(null);
      setError(
        err instanceof Error && err.message !== "UPLOAD_FAILED"
          ? err.message
          : tErrors("UPLOAD_FAILED"),
      );
    } finally {
      setBusy(false);
    }
  }

  const initial = fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 sm:w-40">
      <div className="relative">
        <Avatar className="size-28 shadow-md ring-2 ring-background">
          <AvatarImage src={preview ?? avatarUrl ?? undefined} alt={t("avatarAlt")} />
          <AvatarFallback className="text-3xl">{initial}</AvatarFallback>
        </Avatar>
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="size-6 animate-spin" />
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-4" /> {t("changeAvatar")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t("imageHint", { maxMb: MAX_MB })}
      </p>
      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
