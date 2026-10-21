"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { AvailabilityRuleDto } from "@/server/services/provider";
import { setAvailabilityRulesAction } from "@/app/(provider)/dashboard/profile/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const WEEKDAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface DayState {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function buildInitialState(initialAvailability: AvailabilityRuleDto[]): DayState[] {
  return WEEKDAY_LABELS.map((_, weekday) => {
    const rule = initialAvailability.find((r) => r.weekday === weekday);
    return {
      enabled: Boolean(rule),
      startTime: rule?.startTime.slice(0, 5) ?? "08:00",
      endTime: rule?.endTime.slice(0, 5) ?? "18:00",
    };
  });
}

export function AvailabilityEditor({
  initialAvailability,
}: {
  initialAvailability: AvailabilityRuleDto[];
}) {
  const router = useRouter();
  const [days, setDays] = useState<DayState[]>(() => buildInitialState(initialAvailability));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function updateDay(weekday: number, patch: Partial<DayState>) {
    setDays((current) => current.map((day, i) => (i === weekday ? { ...day, ...patch } : day)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const rules = days
      .map((day, weekday) => ({ ...day, weekday }))
      .filter((day) => day.enabled)
      .map((day) => ({
        weekday: day.weekday,
        startTime: day.startTime,
        endTime: day.endTime,
      }));

    const result = await setAvailabilityRulesAction({ rules });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSavedAt(Date.now());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">เวลาทำงานรายสัปดาห์</h2>
      {days.map((day, weekday) => (
        <div key={weekday} className="flex items-center gap-3">
          <Checkbox
            checked={day.enabled}
            onCheckedChange={(checked) => updateDay(weekday, { enabled: checked === true })}
          />
          <span className="w-20 text-sm">{WEEKDAY_LABELS[weekday]}</span>
          <Input
            type="time"
            value={day.startTime}
            disabled={!day.enabled}
            onChange={(e) => updateDay(weekday, { startTime: e.target.value })}
            className="h-10 w-28"
          />
          <span>-</span>
          <Input
            type="time"
            value={day.endTime}
            disabled={!day.enabled}
            onChange={(e) => updateDay(weekday, { endTime: e.target.value })}
            className="h-10 w-28"
          />
        </div>
      ))}

      <Button type="button" className="h-12" disabled={saving} onClick={handleSave}>
        {saving ? <Loader2 className="animate-spin" /> : "บันทึกเวลาทำงาน"}
      </Button>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {savedAt ? <p className="text-sm text-green-600">บันทึกแล้ว</p> : null}
    </div>
  );
}
