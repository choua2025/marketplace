"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { updateBookingStatusAction } from "@/app/[locale]/bookings/[id]/actions";
import type { BookingStatus } from "@/lib/validations/booking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface BookingActionsProps {
  bookingId: string;
  status: BookingStatus;
  isCustomer: boolean;
  isProvider: boolean;
}

export function BookingActions({ bookingId, status, isCustomer, isProvider }: BookingActionsProps) {
  const t = useTranslations("booking");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function runTransition(nextStatus: BookingStatus, extra?: { cancelReason?: string }) {
    setLoading(true);
    setError(null);
    const result = await updateBookingStatusAction(bookingId, { status: nextStatus, ...extra });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const canCancel =
    isCustomer || isProvider ? status === "pending" || status === "confirmed" : false;

  return (
    <div className="flex flex-col gap-2">
      {isProvider && status === "pending" ? (
        <Button className="h-12" disabled={loading} onClick={() => runTransition("confirmed")}>
          {loading ? <Loader2 className="animate-spin" /> : t("actionConfirm")}
        </Button>
      ) : null}

      {isProvider && status === "confirmed" ? (
        <Button className="h-12" disabled={loading} onClick={() => runTransition("in_progress")}>
          {loading ? <Loader2 className="animate-spin" /> : t("actionStart")}
        </Button>
      ) : null}

      {isProvider && status === "in_progress" ? (
        <Button className="h-12" disabled={loading} onClick={() => runTransition("completed")}>
          {loading ? <Loader2 className="animate-spin" /> : t("actionComplete")}
        </Button>
      ) : null}

      {canCancel ? (
        showCancelForm ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t("cancelReasonPlaceholder")}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={loading || !cancelReason.trim()}
                onClick={() => runTransition("cancelled", { cancelReason })}
              >
                {loading ? <Loader2 className="animate-spin" /> : t("confirmCancel")}
              </Button>
              <Button variant="ghost" onClick={() => setShowCancelForm(false)}>
                {t("keepBooking")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="h-12" onClick={() => setShowCancelForm(true)}>
            {t("cancelBooking")}
          </Button>
        )
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
