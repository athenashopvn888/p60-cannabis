import { createHmac } from "node:crypto";
import { KITCHEN_PIN_HASH_TEMP, PIN_TTL_MS } from "./constants.ts";
import { safeEqual, verifyPin } from "./crypto.ts";

export type KitchenTicket = {
  v: 1;
  role: "kitchen";
  store: "PNY01";
  exp: number;
};

/** Real stock writes stay off unless production and Tri's flag are both on. Preview is always a dry run. */
export function kitchenWritesEnabled() {
  return process.env.VERCEL_ENV === "production" && process.env.PNY_KITCHEN_WRITES === "1";
}

export function kitchenPinHash() {
  const fromEnv = process.env.PNY_KITCHEN_PIN_HASH?.trim();
  return fromEnv || KITCHEN_PIN_HASH_TEMP;
}

export function kitchenPinMatches(pin: string) {
  return verifyPin(pin, kitchenPinHash());
}

export function signKitchenSession(secret: string, nowMs: number) {
  if (!secret) throw new Error("Session secret is not configured.");
  const ticket: KitchenTicket = {
    v: 1,
    role: "kitchen",
    store: "PNY01",
    exp: Math.floor((nowMs + PIN_TTL_MS) / 1000),
  };
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `k1.${body}.${sig}`;
}

export function readKitchenSession(token: string, secret: string, nowMs: number): KitchenTicket | null {
  if (!secret || !token.startsWith("k1.")) return null;
  const [, body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as KitchenTicket;
    if (ticket.v !== 1 || ticket.role !== "kitchen" || ticket.store !== "PNY01") return null;
    if (ticket.exp * 1000 <= nowMs) return null;
    return ticket;
  } catch {
    return null;
  }
}
