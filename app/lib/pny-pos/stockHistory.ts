import { STORE_TZ } from "./constants.ts";
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

/** Inventory-sheet tab: quarter key -> spreadsheet id. `analytics` is not used. */
export const HISTORY_CONFIG_TAB = "History_Config";

const warnedQuarters = new Set<string>();

export function historyPeriod(iso: string, timeZone = STORE_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const quarter = `${year}-Q${Math.ceil(Number(month) / 3)}`;
  return { quarter, tab: `History_${year}-${month}` };
}

/** `2026-Q4=sheetId,2027-Q1=sheetId`. Env overrides the History_Config tab. */
export function parseHistorySheetEnv(raw: string | undefined) {
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const part of raw.split(/[\n,]/)) {
    const trimmed = part.trim();
    const split = trimmed.indexOf("=");
    if (split <= 0) continue;
    const key = trimmed.slice(0, split).trim();
    const id = trimmed.slice(split + 1).trim();
    if (key && id) map.set(key, id);
  }
  return map;
}

export function historySheetConfig(rows: { key?: string; quarter?: string; spreadsheet_id?: string }[], envRaw: string | undefined) {
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = String(row.key || row.quarter || "").trim();
    const id = String(row.spreadsheet_id || "").trim();
    if (key && id && key.toLowerCase() !== "analytics") map.set(key, id);
  }
  for (const [key, id] of parseHistorySheetEnv(envRaw)) map.set(key, id);
  return map;
}

export function warnMissingHistorySheet(quarter: string) {
  if (warnedQuarters.has(quarter)) return;
  warnedQuarters.add(quarter);
  console.warn(`PNY stock history spreadsheet for ${quarter} is not configured. Appending to Stock_History on the inventory sheet. Set PNY_HISTORY_SHEETS or the History_Config tab.`);
}

export function planHistoryWrites(rows: StockHistoryRow[], config: Map<string, string>) {
  const planned: { spreadsheetId: string | null; quarter: string; tab: string; rows: StockHistoryRow[] }[] = [];
  for (const row of rows) {
    const period = historyPeriod(row.timestamp_iso);
    const spreadsheetId = config.get(period.quarter)?.trim() || null;
    const tab = spreadsheetId ? period.tab : STOCK_HISTORY_TAB;
    if (!spreadsheetId) warnMissingHistorySheet(period.quarter);
    const existing = planned.find((item) => item.spreadsheetId === spreadsheetId && item.tab === tab);
    if (existing) existing.rows.push(row);
    else planned.push({ spreadsheetId, quarter: period.quarter, tab, rows: [row] });
  }
  return planned;
}

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
