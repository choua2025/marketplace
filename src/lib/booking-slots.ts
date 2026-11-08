import { MAX_BOOKING_DURATION_MS, MAX_LEAD_TIME_MS, MIN_LEAD_TIME_MS } from "@/lib/validations/booking";

/**
 * Turns a provider's weekly working hours into the days and times a customer
 * can pick in the booking form. Everything is in the provider's timezone --
 * the same rule the server checks (OUTSIDE_WORKING_HOURS): the booking has
 * to start and end inside one working window of one day, and must not
 * overlap time the provider has already confirmed (SLOT_TAKEN).
 */

export interface WorkingHoursRule {
  weekday: number; // 0 = Sunday
  startTime: string; // "HH:MM" or "HH:MM:SS"
  endTime: string;
}

export interface BookableDay {
  /** Provider-local calendar date, "YYYY-MM-DD". */
  date: string;
  weekday: number;
  /** Start times ("HH:MM") still bookable on this day; empty = day off or full. */
  startTimes: string[];
}

/** Time the provider has already promised to someone (epoch ms, end exclusive). */
export interface BusyRange {
  start: number;
  end: number;
}

export const SLOT_STEP_MINUTES = 30;
const MINUTE_MS = 60_000;
export const BOOKING_DAYS_SHOWN = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "HH:MM" (or "HH:MM:SS") -> minutes since midnight. */
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Wall-clock parts of an instant in a timezone. */
function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant when the clock in `timeZone` shows `date` `time`. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const minutes = toMinutes(time);
  const guess =
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) +
    minutes * 60_000;
  const first = guess - offsetMs(new Date(guess), timeZone);
  // A second pass settles the offset on daylight-saving changeover days.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

const overlapsBusy = (busy: BusyRange[], start: number, end: number) =>
  busy.some((range) => range.start < end && range.end > start);

/** The next `count` provider-local days, each with the start times still bookable. */
export function bookableDays(
  rules: WorkingHoursRule[],
  timeZone: string,
  now = Date.now(),
  count = BOOKING_DAYS_SHOWN,
  busy: BusyRange[] = [],
): BookableDay[] {
  const today = zonedParts(new Date(now), timeZone);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);

  return Array.from({ length: count }, (_, i) => {
    const day = new Date(todayUtc + i * DAY_MS);
    const date = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();

    const startTimes = rules
      .filter((rule) => rule.weekday === weekday)
      .flatMap((rule) => {
        const times: string[] = [];
        for (
          let m = toMinutes(rule.startTime);
          m + SLOT_STEP_MINUTES <= toMinutes(rule.endTime);
          m += SLOT_STEP_MINUTES
        ) {
          const time = fromMinutes(m);
          const at = zonedTimeToUtc(date, time, timeZone).getTime();
          if (at < now + MIN_LEAD_TIME_MS || at > now + MAX_LEAD_TIME_MS) continue;
          // Even the shortest booking from here would run into a confirmed job.
          if (overlapsBusy(busy, at, at + SLOT_STEP_MINUTES * MINUTE_MS)) continue;
          times.push(time);
        }
        return times;
      });

    return { date, weekday, startTimes: [...new Set(startTimes)].sort() };
  });
}

/**
 * End times for a booking starting at `startTime`: up to the end of that
 * working window, 12 hours at most -- and, given `startAt` (the start as an
 * instant) and `busy`, no later than the provider's next confirmed job.
 */
export function endTimeOptions(
  rules: WorkingHoursRule[],
  weekday: number,
  startTime: string,
  booked?: { startAt: number; busy: BusyRange[] },
): string[] {
  const start = toMinutes(startTime);
  const window = rules.find(
    (rule) =>
      rule.weekday === weekday && toMinutes(rule.startTime) <= start && start < toMinutes(rule.endTime),
  );
  if (!window) return [];

  let last = Math.min(toMinutes(window.endTime), start + MAX_BOOKING_DURATION_MS / MINUTE_MS);
  if (booked) {
    const nextBusy = Math.min(
      ...booked.busy.filter((range) => range.start >= booked.startAt).map((range) => range.start),
    );
    // Infinity when nothing is booked later; the window end still applies.
    last = Math.min(last, start + Math.floor((nextBusy - booked.startAt) / MINUTE_MS));
  }
  const times: string[] = [];
  for (let m = start + SLOT_STEP_MINUTES; m <= last; m += SLOT_STEP_MINUTES) times.push(fromMinutes(m));
  // A window ending off the half hour (e.g. 17:45) can still be booked up to its end.
  if (last > start && !times.includes(fromMinutes(last))) times.push(fromMinutes(last));
  return times;
}
