"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  createReviewAction,
  updateReviewAction,
} from "@/app/[locale]/bookings/[id]/review/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReviewFormProps {
  bookingId: string;
  reviewId: string | null;
  initialRating: number;
  initialComment: string;
}

export function ReviewForm({
  bookingId,
  reviewId,
  initialRating,
  initialComment,
}: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = reviewId
      ? await updateReviewAction(reviewId, { rating, comment: comment || undefined })
      : await createReviewAction({ bookingId, rating, comment: comment || undefined });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/bookings/${bookingId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">คะแนน</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} ดาว`}
              className="p-1"
            >
              <Star
                className={`size-8 ${value <= rating ? "fill-current text-amber-500" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="comment" className="text-sm font-medium">
          ความเห็น (ไม่บังคับ)
        </label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="บอกเล่าประสบการณ์การใช้บริการ"
        />
      </div>

      <Button type="button" className="h-12" disabled={submitting} onClick={handleSubmit}>
        {submitting ? (
          <Loader2 className="animate-spin" />
        ) : reviewId ? (
          "บันทึกการแก้ไข"
        ) : (
          "ส่งรีวิว"
        )}
      </Button>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
