"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarX } from "lucide-react";
import {
  bookableDays,
  endTimeOptions,
  toMinutes,
  zonedTimeToUtc,
  type BusyRange,
  type WorkingHoursRule,
} from "@/lib/booking-slots";
import { cn } from "@/lib/utils";

interface BookingTimePickerProps {
  rules: WorkingHoursRule[];
  /** The provider's timezone -- days and times are shown on their clock. */
  timezone: string;
  /** Time the provider has already confirmed -- not offered. */
  busy: BusyRange[];
  /** Passed from the server so the server render and hydration agree. */
  now: number;
  /** ISO start/end, or empty strings until a full range is picked. */
  onChange: (startAt: string, endAt: string) => void;
}

function Chip({
  selected,
  disabled,
  onClick,
  className,
  ariaLabel,
  children,
  ...data
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  "data-date"?: string;
}) {
  return (
    <button
      type="button"
      {...data}
      aria-label={ariaLabel}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:border-primary/60 hover:bg-primary/5",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Day + start + end picker limited to the provider's working hours (SPEC.md section 8). */
export function BookingTimePicker({
  rules,
  timezone,
  busy,
  now,
  onChange,
}: BookingTimePickerProps) {
  const t = useTranslations("booking");
  const tWeekdays = useTranslations("weekdays");
  const tMonths = useTranslations("monthsShort");
  const days = useMemo(
    () => bookableDays(rules, timezone, now, undefined, busy),
    [rules, timezone, now, busy],
  );

  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const day = days.find((d) => d.date === date);
  const endsFor = (d: { date: string; weekday: number }, startTime: string) =>
    endTimeOptions(rules, d.weekday, startTime, {
      startAt: zonedTimeToUtc(d.date, startTime, timezone).getTime(),
      busy,
    });
  const ends = day && start ? endsFor(day, start) : [];

  function emit(nextDate: string | null, nextStart: string | null, nextEnd: string | null) {
    if (!nextDate || !nextStart || !nextEnd) return onChange("", "");
    onChange(
      zonedTimeToUtc(nextDate, nextStart, timezone).toISOString(),
      zonedTimeToUtc(nextDate, nextEnd, timezone).toISOString(),
    );
  }

  function pickDay(nextDate: string) {
    setDate(nextDate);
    setStart(null);
    setEnd(null);
    emit(nextDate, null, null);
  }

  function pickStart(nextStart: string) {
    if (!day) return;
    const options = endsFor(day, nextStart);
    // Default to one hour (or the first end time if the window is shorter).
    const nextEnd = options.find((e) => toMinutes(e) - toMinutes(nextStart) >= 60) ?? options[0] ?? null;
    setStart(nextStart);
    setEnd(nextEnd);
    emit(day.date, nextStart, nextEnd);
  }

  function pickEnd(nextEnd: string) {
    setEnd(nextEnd);
    emit(date, start, nextEnd);
  }

  if (days.every((d) => d.startTimes.length === 0)) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <CalendarX className="size-5 shrink-0" />
        {t("noAvailability")}
      </div>
    );
  }

  // Labels come from our own messages, not Intl: Node and browsers ship
  // different locale data (e.g. Thai short weekdays, Lao months), and a
  // mismatch between the server render and hydration breaks the page.
  const dayLabel = (d: { date: string; weekday: number }) => ({
    weekday: tWeekdays(String(d.weekday)),
    day: String(Number(d.date.slice(8, 10))),
    month: tMonths(String(Number(d.date.slice(5, 7)) - 1)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p id="pick-day" className="text-sm font-medium">
          {t("pickDayLabel")}
        </p>
        <div
          role="group"
          aria-labelledby="pick-day"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {days.map((d) => {
            const label = dayLabel(d);
            return (
              <Chip
                key={d.date}
                data-date={d.date}
                ariaLabel={`${label.weekday} ${label.day} ${label.month}`}
                selected={d.date === date}
                disabled={d.startTimes.length === 0}
                onClick={() => pickDay(d.date)}
                className="flex min-w-16 shrink-0 flex-col items-center px-2 py-2"
              >
                <span className="text-xs whitespace-nowrap">{label.weekday}</span>
                <span className="text-lg leading-tight font-semibold">{label.day}</span>
                <span className="text-xs">{label.month}</span>
              </Chip>
            );
          })}
        </div>
      </div>

      {day ? (
        <div className="flex flex-col gap-2">
          <p id="pick-start" className="text-sm font-medium">
            {t("startAtLabel")}
          </p>
          <div
            role="group"
            aria-labelledby="pick-start"
            className="grid grid-cols-4 gap-2 sm:grid-cols-6"
          >
            {day.startTimes.map((time) => (
              <Chip
                key={time}
                selected={time === start}
                onClick={() => pickStart(time)}
                className="h-10"
              >
                {time}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {ends.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p id="pick-end" className="text-sm font-medium">
            {t("endAtLabel")}
          </p>
          <div
            role="group"
            aria-labelledby="pick-end"
            className="grid grid-cols-4 gap-2 sm:grid-cols-6"
          >
            {ends.map((time) => (
              <Chip key={time} selected={time === end} onClick={() => pickEnd(time)} className="h-10">
                {time}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
