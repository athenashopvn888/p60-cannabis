import { verifyPin } from "./crypto.ts";

export type SpecialPinRole = "master" | "kitchen" | "demo";

const ENV_BY_ROLE: Record<SpecialPinRole, string> = {
  master: "PNY_MASTER_PIN_HASH",
  kitchen: "PNY_KITCHEN_PIN_HASH",
  demo: "PNY_DEMO_PIN_HASH",
};

export function specialPinHash(role: SpecialPinRole) {
  return process.env[ENV_BY_ROLE[role]]?.trim() || null;
}

/** A missing or malformed hash disables that special login. */
export function specialPinMatches(role: SpecialPinRole, pin: string) {
  return /^\d{1,6}$/.test(pin) && verifyPin(pin, specialPinHash(role));
}
