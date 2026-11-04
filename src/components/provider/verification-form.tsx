"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, Upload } from "lucide-react";
import { submitVerificationAction } from "@/app/[locale]/(provider)/dashboard/verification/actions";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VerificationFormProps {
  initialDocuments: { key: string; url: string | null }[];
  initialNote: string | null;
}

export function VerificationForm({ initialDocuments, initialNote }: VerificationFormProps) {
  const t = useTranslations("verification");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [note, setNote] = useState(initialNote ?? "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const key = await uploadFile(file, "verification");
      setDocuments((prev) => [...prev, { key, url: URL.createObjectURL(file) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove(key: string) {
    setDocuments((prev) => prev.filter((d) => d.key !== key));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await submitVerificationAction({
      documentKeys: documents.map((d) => d.key),
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="mb-2 font-medium">
          {t("documentsLabel")} ({documents.length}/5)
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {documents.map((doc) => (
            <div key={doc.key} className="relative aspect-square">
              {doc.url ? (
                <Image src={doc.url} alt="" fill className="rounded-md object-cover" unoptimized />
              ) : (
                <div className="size-full rounded-md bg-muted" />
              )}
              <button
                type="button"
                onClick={() => handleRemove(doc.key)}
                className="absolute top-1 right-1 rounded-full bg-background/80 p-1"
                aria-label={t("removeDocument")}
              >
                <Trash2 className="size-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          disabled={uploading || documents.length >= 5}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
          {t("uploadDocument")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="verification-note">
          {t("noteLabel")}
        </label>
        <Textarea
          id="verification-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" disabled={submitting || documents.length === 0} onClick={handleSubmit}>
        {submitting ? <Loader2 className="animate-spin" /> : null}
        {t("submit")}
      </Button>
    </div>
  );
}
