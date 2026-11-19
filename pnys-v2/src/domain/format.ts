import type { MoneyKind } from "./close";

export function dollars(cents: number, signed = false): string {
  const absolute = Math.abs(cents) / 100;
  const prefix = signed ? (cents > 0 ? "+" : cents < 0 ? "−" : "") : cents < 0 ? "−" : "";
  return `${prefix}$${absolute.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function signedQty(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
}

export function finalLabel(kind: MoneyKind, cents: number): string {
  if (kind === "EVEN") return "EVEN $0.00";
  return `${kind} ${dollars(cents, true)}`;
}

export function resultClass(kind: MoneyKind): "over" | "short" | "neutral" {
  return kind === "OVER" ? "over" : kind === "SHORT" ? "short" : "neutral";
}
