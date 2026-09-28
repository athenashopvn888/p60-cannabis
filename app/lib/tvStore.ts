import { gbpLocation } from "./gbp-location";

type OpeningHours = {
  dayOfWeek: readonly string[];
  opens: string;
  closes: string;
};

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * Structured hours copied from the Store JSON-LD `openingHoursSpecification`
 * in app/layout.tsx. Display strings come from app/lib/gbp-location.ts.
 */
const OPENING_HOURS: readonly OpeningHours[] = [
  {
    dayOfWeek: WEEKDAYS,
    opens: "00:00",
    closes: "23:59",
  },
];

function clockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return 24 * 60;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function coversAllDay(opens: string, closes: string) {
  const open = clockMinutes(opens);
  const close = clockMinutes(closes);
  if (open == null || close == null) return false;
  return open === 0 && (close >= 23 * 60 + 59 || close === 24 * 60);
}

/** True only when every weekday is covered by an all-day window. */
export function isOpen24Hours7Days(specs: readonly OpeningHours[] = OPENING_HOURS) {
  const covered = new Set<string>();
  for (const spec of specs) {
    if (!coversAllDay(spec.opens, spec.closes)) return false;
    for (const day of spec.dayOfWeek) covered.add(day);
  }
  return WEEKDAYS.every((day) => covered.has(day));
}

const shortAddress = [gbpLocation.streetAddress, gbpLocation.city].filter(Boolean).join(", ");
const hours = gbpLocation.hours.map((line) => line.trim()).filter(Boolean).join(" · ");

export const tvStore = {
  name: gbpLocation.storeName,
  shortAddress,
  hours,
  open24Hours7Days: isOpen24Hours7Days(),
};
