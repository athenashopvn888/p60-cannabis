import { gbpLocation } from "./gbp-location.ts";

/** Monday-first week, matching the store openingHoursSpecification. */
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const WEEK_MINUTES = 7 * 24 * 60;
const DAY_MINUTES = 24 * 60;

const DAY_BY_ABBR: Record<string, (typeof WEEKDAYS)[number]> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};

export type OpeningHoursSpec = {
  dayOfWeek: readonly string[];
  opens: string;
  closes: string;
};

export type StoreHoursStatus = {
  kind: "always" | "open" | "closed";
  label: string;
};

/**
 * Walk-in windows from the existing `schemaHours` strings in gbp-location
 * (`Mo-Su 00:00-23:59`). The same 00:00–23:59 week is published in the
 * layout JSON-LD and in tvStore.
 */
export function openingHoursFromSchema(lines: readonly string[]): OpeningHoursSpec[] {
  const specs: OpeningHoursSpec[] = [];
  for (const line of lines) {
    const match = /^([A-Z][a-z])-([A-Z][a-z])\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(line.trim());
    if (!match) continue;
    const start = DAY_BY_ABBR[match[1]];
    const end = DAY_BY_ABBR[match[2]];
    if (!start || !end) continue;
    const startIndex = WEEKDAYS.indexOf(start);
    const endIndex = WEEKDAYS.indexOf(end);
    if (startIndex < 0 || endIndex < startIndex) continue;
    specs.push({
      dayOfWeek: WEEKDAYS.slice(startIndex, endIndex + 1),
      opens: match[3],
      closes: match[4],
    });
  }
  return specs;
}

export const STORE_OPENING_HOURS: readonly OpeningHoursSpec[] = openingHoursFromSchema(gbpLocation.schemaHours);

type Interval = { start: number; end: number };

/** Same all-day rule as `isOpen24Hours7Days` in tvStore.ts. */
function isOpen24Hours7Days(specs: readonly OpeningHoursSpec[]) {
  const covered = new Set<string>();
  for (const spec of specs) {
    const open = clockMinutes(spec.opens);
    const close = clockMinutes(spec.closes);
    const allDay = open === 0 && close != null && (close >= 23 * 60 + 59 || close === DAY_MINUTES);
    if (!allDay) return false;
    for (const day of spec.dayOfWeek) covered.add(day);
  }
  return WEEKDAYS.every((day) => covered.has(day));
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return DAY_MINUTES;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function torontoNow(now: Date): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Monday";
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (hour === 24) hour = 0;
  return { weekday, minutes: hour * 60 + minute };
}

function expandIntervals(specs: readonly OpeningHoursSpec[]): Interval[] {
  const intervals: Interval[] = [];
  for (const spec of specs) {
    const open = clockMinutes(spec.opens);
    const close = clockMinutes(spec.closes);
    if (open == null || close == null || close === open) continue;
    for (const day of spec.dayOfWeek) {
      const dayIndex = WEEKDAYS.indexOf(day as (typeof WEEKDAYS)[number]);
      if (dayIndex < 0) continue;
      const start = dayIndex * DAY_MINUTES + open;
      const end = dayIndex * DAY_MINUTES + close + (close < open ? DAY_MINUTES : 0);
      if (end > start) intervals.push({ start, end });
    }
  }
  return intervals;
}

function covers(pos: number, interval: Interval) {
  return (
    (pos >= interval.start && pos < interval.end) ||
    (pos + WEEK_MINUTES >= interval.start && pos + WEEK_MINUTES < interval.end)
  );
}

function formatClock(minutes: number): string {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? "p.m." : "a.m.";
  const hour12 = hour24 % 12 || 12;
  if (minute === 0) return `${hour12} ${suffix}`;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatOpening(absMinutes: number, nowPos: number): string {
  const time = formatClock(absMinutes);
  const nowDay = Math.floor(nowPos / DAY_MINUTES);
  const openDay = Math.floor(absMinutes / DAY_MINUTES);
  if (openDay === nowDay) return time;
  return `${WEEKDAYS[openDay % 7].slice(0, 3)} ${time}`;
}

/**
 * Live walk-in status in America/Toronto.
 * "Open 24 hours" when every day is an all-day window.
 * Otherwise "Open now · until X" or "Closed · opens X".
 */
export function storeHoursStatus(
  now: Date = new Date(),
  specs: readonly OpeningHoursSpec[] = STORE_OPENING_HOURS,
): StoreHoursStatus {
  if (isOpen24Hours7Days(specs)) {
    return { kind: "always", label: "Open 24 hours" };
  }

  const { weekday, minutes } = torontoNow(now);
  const dayIndex = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  const pos = (dayIndex < 0 ? 0 : dayIndex) * DAY_MINUTES + minutes;
  const intervals = expandIntervals(specs);
  const active = intervals.filter((interval) => covers(pos, interval));

  if (active.length > 0) {
    const end = active.reduce((latest, interval) => Math.max(latest, interval.end), 0);
    return { kind: "open", label: `Open now · until ${formatClock(end)}` };
  }

  let next: number | null = null;
  for (const interval of intervals) {
    for (const start of [interval.start, interval.start + WEEK_MINUTES]) {
      if (start > pos && (next == null || start < next)) next = start;
    }
  }

  if (next == null) return { kind: "closed", label: "Closed" };
  return { kind: "closed", label: `Closed · opens ${formatOpening(next, pos)}` };
}
