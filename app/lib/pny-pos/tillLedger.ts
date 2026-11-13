import { formatMoney, roundCents } from "./money.ts";

/** One counted difference. Positive units means more was found than expected. */
export type AdjustLine = {
  sku: string;
  text: string;
  units: number;
  cents: number;
};

/** Dollars that increase a SHORT balance. Extra stock or extra float is negative. */
export function shortSideCents(lines: { cents: number }[]) {
  return -lines.reduce((sum, line) => sum + line.cents, 0);
}

/**
 * Cash sales, minus deposits, minus the float left in the drawer,
 * plus each section's short-side adjustment.
 * Positive means SHORT. Negative means OVER.
 */
export function tillBalanceRaw(input: {
  cash_sales_cents: number;
  deposited_cents: number;
  float_cents: number;
  open_cents: number;
  refill_cents: number;
  close_cents: number;
}) {
  return roundCents(input.cash_sales_cents)
    - roundCents(input.deposited_cents)
    - roundCents(input.float_cents)
    + roundCents(input.open_cents)
    + roundCents(input.refill_cents)
    + roundCents(input.close_cents);
}

export function balancePhrase(rawCents: number) {
  const raw = roundCents(rawCents);
  if (raw < 0) return { word: "OVER" as const, cents: -raw, tone: "over" as const };
  if (raw > 0) return { word: "SHORT" as const, cents: raw, tone: "short" as const };
  return { word: "EVEN" as const, cents: 0, tone: "even" as const };
}

/** Float found minus float expected. Positive is extra cash. */
export function floatGapCents(expectedCents: number, foundCents: number) {
  return roundCents(foundCents) - roundCents(expectedCents);
}

export function floatPhrase(gapCents: number) {
  const gap = roundCents(gapCents);
  if (gap > 0) return { word: "OVER" as const, cents: gap, tone: "over" as const };
  if (gap < 0) return { word: "SHORT" as const, cents: -gap, tone: "short" as const };
  return { word: "EVEN" as const, cents: 0, tone: "even" as const };
}

export function adjustMoney(cents: number) {
  const rounded = roundCents(cents);
  if (rounded > 0) return `+${formatMoney(rounded)}`;
  return formatMoney(rounded);
}
