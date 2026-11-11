import { quoteForSku } from "./sizePrice.ts";
import { sizeLabel, staffSkuText } from "./verifyCount.ts";
import type { ClosingLine, State } from "./types.ts";

export type SummarySku = { text: string; units: number; cents: number };

export type ClosingSummaryView = {
  weedInStore: boolean | null;
  cashSalesCents: number;
  depositedCents: number;
  floatCents: number;
  openLines: SummarySku[];
  refillLines: SummarySku[];
  closeLines: SummarySku[];
  floatExpectedCents: number | null;
  floatFoundCents: number | null;
};

function priceOf(state: State, sku: string, line?: ClosingLine) {
  if (line?.price_cents && line.price_cents > 0) return line.price_cents;
  return quoteForSku(sku)?.cents ?? 0;
}

function label(state: State, sku: string) {
  const product = state.products.find((row) => row.sku === sku);
  const closing = state.closings.flatMap((row) => row.closing_lines).find((row) => row.sku === sku);
  const size = sizeLabel(sku, product?.category, product?.name || closing?.name);
  return staffSkuText(sku, size).replace(/^#/, "");
}

/** The approved till summary. Off SKUs only. No on-hand list and no stock totals. */
export function closingSummaryView(state: State, sccxShiftId: string, storeCode: string): ClosingSummaryView | null {
  const shift = state.shifts.find((row) => row.sccx_shift_id === sccxShiftId || row.id === sccxShiftId);
  if (!shift || shift.store_code !== storeCode) return null;
  const closing = state.closings.find((row) => row.shift_id === shift.id);
  if (!closing) return null;
  const draft = state.closing_drafts?.find((row) => row.shift_id === shift.id);
  const openLines: SummarySku[] = [];
  for (const row of draft?.opening_counts ?? []) {
    if (row.accepted_as_is || row.expected_qty == null) continue;
    const units = row.counted_qty - row.expected_qty;
    if (units === 0) continue;
    const price = priceOf(state, row.sku);
    openLines.push({ text: label(state, row.sku), units, cents: units * price });
  }
  const grouped = new Map<string, { sent: number; received: number }>();
  for (const row of state.incoming) {
    if (row.confirmed_shift_id !== shift.id) continue;
    if (row.status !== "CONFIRMED" && row.status !== "PARTIAL" && row.status !== "REJECTED") continue;
    const current = grouped.get(row.sku) ?? { sent: 0, received: 0 };
    current.sent += row.qty_sent;
    current.received += row.qty_received ?? 0;
    grouped.set(row.sku, current);
  }
  const refillLines: SummarySku[] = [];
  for (const [sku, totals] of grouped) {
    const units = totals.received - totals.sent;
    if (units === 0) continue;
    refillLines.push({ text: label(state, sku), units, cents: units * priceOf(state, sku) });
  }
  const closeLines: SummarySku[] = [];
  for (const line of closing.closing_lines) {
    const units = line.variance_qty ?? line.left - (line.expected_qty ?? line.system_qty);
    if (!units) continue;
    const signed = (line.overage_cents ?? 0) - (line.shortage_cents ?? 0);
    const cents = signed !== 0 ? signed : units * priceOf(state, line.sku, line);
    closeLines.push({ text: label(state, line.sku), units, cents });
  }
  const previous = state.shifts
    .filter((row) => row.store_code === shift.store_code && row.id !== shift.id && row.status === "ENDED" && row.ended_at)
    .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
  const previousFloat = previous ? state.closings.find((row) => row.shift_id === previous.id)?.float_cents ?? 0 : null;
  const found = draft?.float_found_cents ?? null;
  const expected = draft?.float_expected_cents ?? previousFloat;
  return {
    weedInStore: shift.weed_in_store ?? null,
    cashSalesCents: closing.cash_sales_cents ?? closing.sales_total_cents,
    depositedCents: closing.deposited_cents,
    floatCents: closing.float_cents ?? 0,
    openLines,
    refillLines,
    closeLines,
    floatExpectedCents: found == null || expected == null ? null : expected,
    floatFoundCents: found,
  };
}
