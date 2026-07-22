import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { operationalDayContext } from "./staffPhotoCore.ts";

function equalText(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function signStaffSession(secret: string, pinVersion: number, now = Date.now(), boundaryHour = 6) {
  if (secret.length < 32) throw new Error("Staff session secret is not configured.");
  const window = operationalDayContext(new Date(now), boundaryHour);
  const payload = Buffer.from(JSON.stringify({ store: "PNY01", day: window.dayKey, version: pinVersion, exp: Math.floor(window.validUntil.getTime() / 1000) })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function validateStaffSession(token: string, secret: string, expectedVersion: number, now = Date.now(), boundaryHour = 6) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || secret.length < 32) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!equalText(signature, expected)) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const window = operationalDayContext(new Date(now), boundaryHour);
    return value.store === "PNY01" && value.day === window.dayKey && value.version === expectedVersion && Number.isInteger(value.exp) && value.exp > Math.floor(now / 1000);
  } catch { return false; }
}
