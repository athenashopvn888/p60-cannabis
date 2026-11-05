import { STORE_TZ } from "./constants.ts";
import type { ClosingLine, ClosingRow, ShiftRow, State } from "./types.ts";

/** Inventory sheet tab. One master id per store until Tri resets it. */
export const STOCK_LABELS_TAB = "Stock_Labels";
export const STOCK_LABEL_HEADERS = ["store", "master_id", "start_date", "created_at"] as const;

/** Append-only closing snapshots on the inventory sheet. */
export const CLOSE_SNAPSHOTS_TAB = "Close_Snapshots";
export const CLOSE_SNAPSHOT_HEADERS = ["close_label", "master_id", "store", "shift_id", "sku", "name", "category", "qty", "discrepancy", "created_at"] as const;

/** Live PNY01 stock started this day. A later master is only written when Tri changes Stock_Labels. */
export const PNY01_STOCK_START = "2026-11-04";

export type StockLabelRow = {
  store: string;
  master_id: string;
  start_date: string;
  created_at: string;
};

export type CloseSnapshotRow = Record<(typeof CLOSE_SNAPSHOT_HEADERS)[number], string>;

const newLabels = new WeakMap<State, StockLabelRow[]>();
const newSnapshots = new WeakMap<State, CloseSnapshotRow[]>();

export function storeDateParts(iso: string, timeZone = STORE_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return { isoDate: `${year}-${month}-${day}`, mmdd: `${month}${day}` };
}

export function masterPrefix(store: string) {
  return store === "PNY02" ? "PNY2" : "PNY";
}

export function masterIdFor(store: string, startDate: string) {
  const month = startDate.slice(5, 7);
  const day = startDate.slice(8, 10);
  return `${masterPrefix(store)}-${month}${day}`;
}

export function closeLabelFor(masterId: string, closedAtIso: string) {
  return `${masterId}-${storeDateParts(closedAtIso).mmdd}`;
}

function labelsOf(state: State) {
  if (!state.stock_labels) state.stock_labels = [];
  return state.stock_labels;
}

/** Sheet rows win when Tri has already set a master. Does not delete a store. */
export function adoptStockLabels(state: State, rows: StockLabelRow[]) {
  const labels = labelsOf(state);
  for (const row of rows) {
    if (!row.store || !row.master_id || !row.start_date) continue;
    const existing = labels.find((item) => item.store === row.store);
    if (!existing) {
      labels.push({ ...row });
      continue;
    }
    existing.master_id = row.master_id;
    existing.start_date = row.start_date;
    if (row.created_at) existing.created_at = row.created_at;
  }
}

/** Reuse the store's master. Create the first one only when that store has none. */
export function ensureStockLabel(state: State, store: string, at: string, shiftStartedAt: string) {
  const labels = labelsOf(state);
  const existing = labels.find((row) => row.store === store);
  if (existing) return existing;
  const start = store === "PNY01" ? PNY01_STOCK_START : storeDateParts(shiftStartedAt || at).isoDate;
  const created: StockLabelRow = {
    store,
    master_id: masterIdFor(store, start),
    start_date: start,
    created_at: at,
  };
  labels.push(created);
  const pending = newLabels.get(state) ?? [];
  pending.push(created);
  newLabels.set(state, pending);
  return created;
}

export function stampCloseLabel(state: State, shift: ShiftRow, at: string) {
  const store = shift.store_code || "PNY01";
  const master = ensureStockLabel(state, store, at, shift.started_at);
  return { master, close_label: closeLabelFor(master.master_id, at) };
}

export function queueCloseSnapshot(state: State, shift: ShiftRow, closing: ClosingRow, lines: ClosingLine[]) {
  if (!closing.close_label) return;
  const master = labelsOf(state).find((row) => row.store === (shift.store_code || "PNY01"));
  const rows: CloseSnapshotRow[] = lines.map((line) => {
    const product = state.products.find((row) => row.sku === line.sku);
    const discrepancy = line.variance_qty ?? line.left - (line.expected_qty ?? line.system_qty);
    return {
      close_label: closing.close_label ?? "",
      master_id: master?.master_id ?? "",
      store: shift.store_code || "PNY01",
      shift_id: shift.sccx_shift_id || shift.id,
      sku: line.sku,
      name: line.name,
      category: product?.category ?? "",
      qty: String(line.left),
      discrepancy: String(discrepancy),
      created_at: closing.created_at,
    };
  });
  const pending = newSnapshots.get(state) ?? [];
  pending.push(...rows);
  newSnapshots.set(state, pending);
}

export function takeNewStockLabels(state: State) {
  const rows = newLabels.get(state) ?? [];
  newLabels.delete(state);
  return rows;
}

export function takeCloseSnapshots(state: State) {
  const rows = newSnapshots.get(state) ?? [];
  newSnapshots.delete(state);
  return rows;
}
