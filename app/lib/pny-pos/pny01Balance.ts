import { formatMoney, roundCents } from "./money.ts";

export type CashWord = "OVER" | "SHORT" | "EVEN";

/** Positive when the deposits are above cash sales. That extra money is OVER. */
export function cashGapCents(cashSalesCents: number, depositedCents: number) {
  return roundCents(depositedCents) - roundCents(cashSalesCents);
}

export function cashWord(gapCents: number): CashWord {
  if (gapCents > 0) return "OVER";
  if (gapCents < 0) return "SHORT";
  return "EVEN";
}

/** "Cash OVER $1.00" or "STOCK SHORT $1.00". The amount is the absolute value. */
export function moneyPhrase(label: "Cash" | "STOCK", gapCents: number) {
  const word = cashWord(gapCents);
  const amount = formatMoney(Math.abs(roundCents(gapCents)));
  if (word === "EVEN") return `${label} EVEN ${amount}`;
  return `${label} ${word} ${amount}`;
}

export function cashWordText(gapCents: number) {
  return moneyPhrase("Cash", gapCents);
}

export type BalanceLine = {
  sku: string;
  text: string;
  sheet_qty: number;
  counted_qty: number;
  adj: number;
  price_cents: number;
  value_cents: number;
};

export type BalanceSection = {
  short_cents: number;
  over_cents: number;
  lines: BalanceLine[];
};

/** Counted minus the baseline. A zero adjustment is left out of the section. */
export function balanceLine(input: {
  sku: string;
  text: string;
  sheet_qty: number;
  counted_qty: number;
  price_cents: number;
}): BalanceLine | null {
  const adj = input.counted_qty - input.sheet_qty;
  if (adj === 0) return null;
  return { ...input, adj, value_cents: adj * input.price_cents };
}

export function balanceSection(lines: BalanceLine[]): BalanceSection {
  let short_cents = 0;
  let over_cents = 0;
  for (const line of lines) {
    if (line.value_cents < 0) short_cents += -line.value_cents;
    else over_cents += line.value_cents;
  }
  return { short_cents, over_cents, lines };
}

/** Positive when the count is over the baseline, at selling price. */
export function stockNetCents(section: { short_cents: number; over_cents: number }) {
  return section.over_cents - section.short_cents;
}
