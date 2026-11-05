import type { State } from "./types.ts";

/** Same columns the Kitchen app writes. Append-only. */
export const STOCK_HISTORY_TAB = "Stock_History";
export const STOCK_HISTORY_HEADERS = [
  "timestamp_iso",
  "store",
  "sku",
  "name",
  "category",
  "event",
  "delta",
  "on_hand_after",
  "staff",
  "shift_id",
  "source",
  "note",
] as const;

export type StockHistoryRow = Record<(typeof STOCK_HISTORY_HEADERS)[number], string>;

const pending = new WeakMap<State, string[]>();

export function queueStockHistory(state: State, ledgerId: string) {
  const ids = pending.get(state);
  if (ids) ids.push(ledgerId);
  else pending.set(state, [ledgerId]);
}

function historyEvent(state: State, movement: string, refId: string | null): string | null {
  if (movement === "SALE") return "sale";
  if (movement === "VOID") return "void";
  if (movement === "INCOMING_CONFIRM") return "refill";
  if (movement === "ADJUSTMENT") return "adjust";
  if (movement === "OPENING_BALANCE") return "added_stock";
  if (movement === "COUNT_VARIANCE") {
    const kind = state.counts.find((row) => row.id === refId)?.kind;
    return kind === "CLOSING" ? "closing_count" : "opening_verify";
  }
  return null;
}

/** Rows for stock that changed in this commit. Empty when nothing moved. */
export function takeStockHistory(state: State): StockHistoryRow[] {
  const ids = pending.get(state) ?? [];
  pending.delete(state);
  const rows: StockHistoryRow[] = [];
  for (const id of ids) {
    const entry = state.ledger.find((row) => row.id === id);
    if (!entry || entry.qty_delta === 0) continue;
    const event = historyEvent(state, entry.movement_type, entry.ref_id);
    if (!event) continue;
    const product = state.products.find((row) => row.sku === entry.sku);
    const shift = entry.shift_id ? state.shifts.find((row) => row.id === entry.shift_id) : undefined;
    const staff = entry.actor ? state.staff.find((row) => row.staff_uid === entry.actor) : undefined;
    const sale = entry.ref_id ? state.sales.find((row) => row.id === entry.ref_id) : undefined;
    const onHand = state.balances.find((row) => row.sku === entry.sku && (shift ? (shift.store_code === "PNY01" ? !row.store_code || row.store_code === "PNY01" : row.store_code === shift.store_code) : !row.store_code || row.store_code === "PNY01"))?.qty;
    rows.push({
      timestamp_iso: entry.created_at,
      store: shift?.store_code || entry.store_code || "PNY01",
      sku: entry.sku,
      name: product?.name ?? "",
      category: product?.category ?? "",
      event,
      delta: String(entry.qty_delta),
      on_hand_after: String(onHand ?? 0),
      staff: staff?.display_name || entry.actor || "",
      shift_id: shift?.sccx_shift_id || entry.shift_id || "",
      source: "pos",
      note: event === "sale" || event === "void" ? (sale?.ref_no ?? "") : (entry.reason ?? ""),
    });
  }
  return rows;
}
