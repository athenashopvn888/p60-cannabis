import { createHmac, timingSafeEqual } from "node:crypto";
import { operationalDayContext, STORE_CODE } from "./staffPhotoCore.ts";

function rawPin(secret: string, storeCode: string, dayKey: string, version: number) {
  if (secret.length < 32) throw new Error("Daily PIN secret is not configured.");
  const digest = createHmac("sha256", secret).update(`staff-pin:v1:${storeCode}:${dayKey}:${version}`).digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function dailyPin(secret: string, storeCode: string, dayKey: string, version: number) {
  const epoch = Date.parse("2020-01-01T12:00:00Z");
  const target = Date.parse(`${dayKey}T12:00:00Z`);
  if (!Number.isFinite(target) || target < epoch) throw new Error("Invalid operational day.");
  const days = Math.round((target - epoch) / 86_400_000);
  if (!Number.isInteger(version) || version < 1 || version > 10_000) throw new Error("Invalid PIN version.");
  let priorVersionPin = -1;
  for (let currentVersion = 1; currentVersion <= version; currentVersion += 1) {
    let previousDayPin = -1;
    let current = -1;
    for (let offset = 0; offset <= days; offset += 1) {
      const date = new Date(epoch + offset * 86_400_000).toISOString().slice(0, 10);
      current = rawPin(secret, storeCode, date, currentVersion);
      if (current === previousDayPin) current = (current + 1) % 10_000;
      previousDayPin = current;
    }
    if (previousDayPin === priorVersionPin) previousDayPin = (previousDayPin + 1) % 10_000;
    priorVersionPin = previousDayPin;
  }
  return String(priorVersionPin).padStart(4, "0");
}

function equalPin(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function pinWindow(now = new Date()) {
  const boundary = Number(process.env.PNY_STAFF_PIN_BOUNDARY_HOUR || "6");
  return operationalDayContext(now, boundary);
}

export function currentDailyPin(version: number, now = new Date()) {
  const secret = process.env.PNY_STAFF_DAILY_PIN_SECRET || "";
  const window = pinWindow(now);
  return { ...window, pin: dailyPin(secret, STORE_CODE, window.dayKey, version) };
}

export function verifyDailyPin(supplied: string, version: number, now = new Date()) {
  if (!/^\d{4}$/.test(supplied)) return false;
  const secret = process.env.PNY_STAFF_DAILY_PIN_SECRET || "";
  const window = pinWindow(now);
  if (equalPin(supplied, dailyPin(secret, STORE_CODE, window.dayKey, version))) return true;
  const graceMinutes = Math.max(0, Math.min(60, Number(process.env.PNY_STAFF_PREVIOUS_PIN_GRACE_MINUTES || "0")));
  if (now.getTime() - window.validFrom.getTime() > graceMinutes * 60_000) return false;
  return equalPin(supplied, dailyPin(secret, STORE_CODE, window.previousDayKey, version));
}
