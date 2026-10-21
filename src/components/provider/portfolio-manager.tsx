"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";
import {
  addPortfolioItemAction,
  confirmAvatarUploadAction,
  createUploadUrlAction,
  removePortfolioItemAction,
} from "@/app/(provider)/dashboard/profile/actions";
import { Button } from "@/components/ui/button";

interface PortfolioManagerProps {
  avatarUrl: string | null;
  initialPortfolio: { id: string; url: string | null; caption: string | null }[];
}

async function uploadFile(file: File, purpose: "avatar" | "portfolio"): Promise<string> {
  const presignResult = await createUploadUrlAction({
    purpose,
    contentType: file.type,
    contentLength: file.size,
  });
  if (!presignResult.ok) throw new Error(presignResult.error);

  const putResponse = await fetch(presignResult.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) throw new Error("UPLOAD_FAILED");

  return presignResult.data.key;
}

export function PortfolioManager({ avatarUrl, initialPortfolio }: PortfolioManagerProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const key = await uploadFile(file, "avatar");
      const result = await confirmAvatarUploadAction(key);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
    } finally {
      setBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handlePortfolioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const key = await uploadFile(file, "portfolio");
      const result = await addPortfolioItemAction(key);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
    } finally {
      setBusy(false);
      if (portfolioInputRef.current) portfolioInputRef.current.value = "";
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
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="รูปโปรไฟล์"
            width={64}
            height={64}
            className="size-16 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="bg-muted size-16 rounded-full" />
        )}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => avatarInputRef.current?.click()}
        >
          <Upload className="size-4" /> เปลี่ยนรูปโปรไฟล์
        </Button>
      </div>

      <div>
        <h2 className="mb-2 font-medium">แกลเลอรีผลงาน ({initialPortfolio.length}/30)</h2>
        <div className="grid grid-cols-3 gap-2">
          {initialPortfolio.map((item) =>
            item.url ? (
              <div key={item.id} className="relative aspect-square">
                <Image
                  src={item.url}
                  alt={item.caption ?? "ผลงาน"}
                  fill
                  className="rounded-md object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(item.id)}
                  className="bg-background/80 absolute top-1 right-1 rounded-full p-1"
                  aria-label="ลบรูปนี้"
                >
                  <Trash2 className="text-destructive size-4" />
                </button>
              </div>
            ) : null,
          )}
        </div>
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
          className="mt-2"
          disabled={busy || initialPortfolio.length >= 30}
          onClick={() => portfolioInputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
          เพิ่มรูปผลงาน
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
