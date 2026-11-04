"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { reviewVerificationAction } from "@/app/[locale]/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VerificationReviewCardProps {
  providerId: string;
  displayName: string;
  note: string | null;
  documents: { key: string; url: string | null }[];
}

export function VerificationReviewCard({
  providerId,
  displayName,
  note,
  documents,
}: VerificationReviewCardProps) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setSubmitting(true);
    setError(null);
    const result = await reviewVerificationAction(providerId, { approve: true });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    if (!rejectionReason.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await reviewVerificationAction(providerId, {
      approve: false,
      rejectionReason: rejectionReason.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      <p className="font-medium">{displayName}</p>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {documents.map((doc) =>
          doc.url ? (
            <a
              key={doc.key}
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="relative aspect-square"
            >
              <Image src={doc.url} alt="" fill className="rounded-md object-cover" unoptimized />
            </a>
          ) : null,
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder={t("rejectionReasonPlaceholder")}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={submitting || !rejectionReason.trim()}
              onClick={handleReject}
            >
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {t("confirmReject")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setRejecting(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button type="button" disabled={submitting} onClick={handleApprove}>
            {t("approve")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => setRejecting(true)}
          >
            {t("reject")}
          </Button>
        </div>
      )}
    </div>
  );
}
