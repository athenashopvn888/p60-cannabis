import { createHash } from "node:crypto";

export const STORE_CODE = "PNY01";
export const STORE_NAME = "P60 Cannabis";
export const MAX_DAILY_PHOTOS = 2;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MEDIA_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_LOGIN_ATTEMPTS = 6;
export function loginAllowed(recentAttempts: number) { return recentAttempts < MAX_LOGIN_ATTEMPTS; }

export const SHOT_PROMPTS = [
  { key: "storefront-front", label: "Front storefront and sign" },
  { key: "entrance-left", label: "Entrance from the left" },
  { key: "entrance-right", label: "Entrance from the right" },
  { key: "address-sign", label: "Address and store sign" },
  { key: "interior-wide", label: "Wide interior view" },
  { key: "counter-clean", label: "Clean checkout area" },
  { key: "lighting", label: "Store lighting and atmosphere" },
  { key: "accessible-entry", label: "Clear entrance and accessibility" },
  { key: "approach", label: "Street approach to the store" },
  { key: "evening-front", label: "Storefront in the evening" },
] as const;

export const ISSUE_CATEGORIES = [
  "Storefront or signage",
  "Hours appear incorrect",
  "Address or phone appears incorrect",
  "Website problem",
  "Menu problem",
  "Google or Maps problem",
  "Entrance, parking or access",
  "Equipment or display",
  "Cleanliness or maintenance",
  "Other",
] as const;

export const RANDOM_CHECKS = [
  { key: "sign-visible", question: "Is the exterior sign clean and clearly visible?" },
  { key: "entrance-clear", question: "Is the entrance clean and unobstructed?" },
  { key: "hours-visible", question: "Are the posted hours visible and correct?" },
  { key: "address-visible", question: "Is the street address easy to see outside?" },
  { key: "store-lit", question: "Is the store entrance well lit?" },
  { key: "access-clear", question: "Is the customer approach clear and easy to use?" },
] as const;

function partsFor(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function torontoDayKey(date = new Date()) {
  const p = partsFor(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function shiftDay(dayKey: string, amount: number) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function torontoOffsetMinutes(date: Date) {
  const name = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", timeZoneName: "longOffset" })
    .formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "GMT-05:00";
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return -300;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

function boundaryInstant(dayKey: string, boundaryHour: number) {
  const guess = new Date(`${dayKey}T${String(boundaryHour).padStart(2, "0")}:00:00Z`);
  const first = new Date(guess.getTime() - torontoOffsetMinutes(guess) * 60_000);
  return new Date(guess.getTime() - torontoOffsetMinutes(first) * 60_000);
}

export function operationalDayContext(date = new Date(), boundaryHour = 6) {
  if (!Number.isInteger(boundaryHour) || boundaryHour < 0 || boundaryHour > 23) throw new Error("Invalid rotation boundary.");
  const calendarDay = torontoDayKey(date);
  const startToday = boundaryInstant(calendarDay, boundaryHour);
  const dayKey = date < startToday ? shiftDay(calendarDay, -1) : calendarDay;
  return {
    dayKey,
    previousDayKey: shiftDay(dayKey, -1),
    validFrom: boundaryInstant(dayKey, boundaryHour),
    validUntil: boundaryInstant(shiftDay(dayKey, 1), boundaryHour),
  };
}

export function operationalDayKey(date = new Date(), boundaryHour = 6) {
  return operationalDayContext(date, boundaryHour).dayKey;
}

export function torontoWeekKey(date = new Date()) {
  const dayKey = operationalDayContext(date).dayKey;
  const utcDate = new Date(`${dayKey}T12:00:00Z`);
  const weekday = utcDate.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysFromMonday);
  return `week-${utcDate.toISOString().slice(0, 10)}`;
}

export function expiryFor(createdAt = new Date(), boundaryHour = 6) {
  const operationalDayEnd = operationalDayContext(createdAt, boundaryHour).validUntil;
  return new Date(operationalDayEnd.getTime() + MEDIA_RETRY_WINDOW_MS);
}

export function availablePrompts(usedKeys: readonly string[]) {
  const used = new Set(usedKeys);
  return SHOT_PROMPTS.filter((prompt) => !used.has(prompt.key));
}

export function randomCheckForDay(dayKey: string) {
  const digest = createHash("sha256").update(`${STORE_CODE}:${dayKey}`).digest();
  if (digest[0] % 3 !== 0) return null;
  return RANDOM_CHECKS[digest[1] % RANDOM_CHECKS.length];
}

export type ImageKind = "jpeg" | "png" | "webp";

export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export function mimeMatchesKind(mime: string, kind: ImageKind | null) {
  return (mime === "image/jpeg" && kind === "jpeg") || (mime === "image/png" && kind === "png") || (mime === "image/webp" && kind === "webp");
}

export function safeObjectPath(kind: ImageKind, purpose: "daily" | "issue", id: string, date = new Date()) {
  const extension = kind === "jpeg" ? "jpg" : kind;
  return `${purpose}/${torontoDayKey(date)}/${id}.${extension}`;
}
