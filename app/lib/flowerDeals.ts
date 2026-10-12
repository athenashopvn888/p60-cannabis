/**
 * Dual-frame flower deal math for Exotic, Premium, and AAA+.
 * Board headlines stay fixed. Dollar totals come from TIER_CONFIG.
 * Paid totals always sit beside FREE lines: "Pay $X = Ng".
 */

export const BOGO_BUY_2_GET_1 = "Buy 2g Get 1g FREE";
export const BOGO_BUY_3_GET_3 = "Buy 3g Get 3g FREE";

export interface BoardDeal {
  label: string;
  total: string;
  price: number;
  grams: number;
  /** Board notation, e.g. "2g=3g". Absent on the Budget special. */
  equals?: string;
}

export function formatDollars(amount: number): string {
  const cents = Math.round(amount * 100);
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function paidAmount(
  price: { regular: number; sale: number | null } | null,
): number | null {
  if (!price) return null;
  return price.sale ?? price.regular;
}

export function perGramIsExact(price: number, grams: number): boolean {
  if (grams <= 0) return false;
  return Math.round(price * 100) % grams === 0;
}

export function formatPerGram(price: number, grams: number): string {
  const cents = Math.round((price / grams) * 100);
  const body = `${formatDollars(cents / 100)}/g`;
  return perGramIsExact(price, grams) ? body : `~${body}`;
}

export function formatPayEquals(price: number, grams: number): string {
  return `Pay ${formatDollars(price)} = ${grams}g`;
}

export function formatBoardDealLine(deal: BoardDeal, paidPrice = deal.price): string {
  return `${deal.label} · ${formatPayEquals(paidPrice, deal.grams)}`;
}

export function formatAsLowAsAfterPromos(price: number, grams: number): string {
  return `As low as ${formatPerGram(price, grams)} after promos`;
}

export function formatSitewideBogoStrip(): string {
  return `TOP WEED TIER SPECIAL · ${BOGO_BUY_2_GET_1}  ${BOGO_BUY_3_GET_3} *`;
}

export function isBogoDeal(
  deal: BoardDeal | null | undefined,
): deal is BoardDeal & { equals: string } {
  return !!deal?.equals;
}
