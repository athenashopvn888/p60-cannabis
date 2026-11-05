import { SheetUnavailable } from "./errors.ts";
import { emptyState } from "./memory.ts";
import type {
  BalanceRow,
  IdemRow,
  IncomingRow,
  LedgerRow,
  SheetRow,
  ShiftRow,
  State,
} from "./types.ts";

export const STATE_CHUNK = 30_000;
export type StoreName = "PNY01" | "PNY02";

type Slice = {
  slice_revision: number;
  shifts: State["shifts"];
  sessions: State["sessions"];
  sales: State["sales"];
  sale_lines: State["sale_lines"];
  tickets: State["tickets"];
  ticket_lines: State["ticket_lines"];
  counts: State["counts"];
  count_lines: State["count_lines"];
  deposits: State["deposits"];
  closings: State["closings"];
  closing_drafts: State["closing_drafts"];
  incoming: IncomingRow[];
  balances: BalanceRow[];
  ledger: LedgerRow[];
  deposit_seq: number;
};

function storeName(row: { store_code?: string | null }): StoreName {
  return row.store_code === "PNY02" ? "PNY02" : "PNY01";
}

function ledgerStore(row: LedgerRow, shifts: ShiftRow[]): StoreName {
  if (row.store_code === "PNY02" || row.store_code === "PNY01") return row.store_code;
  const shift = shifts.find((item) => item.id === row.shift_id);
  return shift?.store_code === "PNY02" ? "PNY02" : "PNY01";
}

export function chunkHighWater(rows: SheetRow[], prefix: string): number {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const row of rows) {
    const match = pattern.exec(row.row_id ?? "");
    if (!match) continue;
    max = Math.max(max, Number(match[1]) + 1);
  }
  return max;
}

export function packChunks(prefix: string, recordType: string, json: string, previousParts: number): Record<string, string>[] {
  const parts: Record<string, string>[] = [];
  const body = json.length ? json : "{}";
  for (let index = 0; index * STATE_CHUNK < body.length || index === 0; index += 1) {
    parts.push({
      row_id: `${prefix}${String(index).padStart(3, "0")}`,
      record_type: recordType,
      staff_uid: "",
      sccx_id: "",
      pos_id: "",
      display_name: "",
      active: "",
      updated_at: "",
      created_at: "",
      doc: body.slice(index * STATE_CHUNK, (index + 1) * STATE_CHUNK),
    });
    if ((index + 1) * STATE_CHUNK >= body.length) break;
  }
  for (let index = parts.length; index < previousParts; index += 1) {
    parts.push({
      row_id: `${prefix}${String(index).padStart(3, "0")}`,
      record_type: "STATE_RETIRED",
      staff_uid: "",
      sccx_id: "",
      pos_id: "",
      display_name: "",
      active: "",
      updated_at: "",
      created_at: "",
      doc: "",
    });
  }
  return parts;
}

export function packState(state: State, previousParts: number): Record<string, string>[] {
  return packChunks("STATE-", "STATE", JSON.stringify(state), previousParts);
}

export function extractSlice(state: State, store: StoreName): Slice {
  const shifts = state.shifts.filter((row) => storeName(row) === store);
  const shiftIds = new Set(shifts.map((row) => row.id));
  const sales = state.sales.filter((row) => shiftIds.has(row.shift_id));
  const saleIds = new Set(sales.map((row) => row.id));
  const tickets = state.tickets.filter((row) => shiftIds.has(row.shift_id));
  const ticketIds = new Set(tickets.map((row) => row.id));
  const counts = state.counts.filter((row) => shiftIds.has(row.shift_id));
  const countIds = new Set(counts.map((row) => row.id));
  return {
    slice_revision: store === "PNY01" ? state.revision_pny01 ?? 0 : state.revision_pny02 ?? 0,
    shifts,
    sessions: state.sessions.filter((row) => shiftIds.has(row.shift_id)),
    sales,
    sale_lines: state.sale_lines.filter((row) => saleIds.has(row.sale_id)),
    tickets,
    ticket_lines: state.ticket_lines.filter((row) => ticketIds.has(row.ticket_id)),
    counts,
    count_lines: state.count_lines.filter((row) => countIds.has(row.count_id)),
    deposits: state.deposits.filter((row) => shiftIds.has(row.shift_id)),
    closings: state.closings.filter((row) => shiftIds.has(row.shift_id)),
    closing_drafts: state.closing_drafts.filter((row) => shiftIds.has(row.shift_id)),
    incoming: state.incoming.filter((row) => storeName(row) === store),
    balances: state.balances.filter((row) => storeName(row) === store),
    ledger: state.ledger.filter((row) => ledgerStore(row, state.shifts) === store),
    deposit_seq: store === "PNY01" ? state.deposit_seq ?? 0 : state.deposit_seq_pny02 ?? 0,
  };
}

export function packSlice(state: State, store: StoreName, previousParts: number): Record<string, string>[] {
  const prefix = store === "PNY01" ? "P1-" : "P2-";
  const recordType = store === "PNY01" ? "STATE_P1" : "STATE_P2";
  return packChunks(prefix, recordType, JSON.stringify(extractSlice(state, store)), previousParts);
}

function tryState(raw: string): State | null {
  try {
    const value = JSON.parse(raw) as State;
    if (!value || typeof value !== "object" || !Array.isArray(value.shifts)) return null;
    return value;
  } catch {
    return null;
  }
}

function joined(rows: SheetRow[], recordType: string, prefix: string): string | null {
  const parts = rows
    .filter((row) => row.record_type === recordType && row.row_id?.startsWith(prefix) && row.doc)
    .sort((a, b) => (a.row_id ?? "").localeCompare(b.row_id ?? ""));
  if (parts.length === 0) return null;
  return parts.map((row) => row.doc).join("");
}

function parseSlice(raw: string | null): Slice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Slice;
    if (!value || !Array.isArray(value.shifts)) return null;
    return value;
  } catch {
    return null;
  }
}

function applySlice(base: State, slice: Slice, store: StoreName): State {
  const next = structuredClone(base) as State;
  const removeShifts = new Set(next.shifts.filter((row) => storeName(row) === store).map((row) => row.id));
  const removeSales = new Set(next.sales.filter((row) => removeShifts.has(row.shift_id)).map((row) => row.id));
  const removeTickets = new Set(next.tickets.filter((row) => removeShifts.has(row.shift_id)).map((row) => row.id));
  const removeCounts = new Set(next.counts.filter((row) => removeShifts.has(row.shift_id)).map((row) => row.id));
  const keptLedger = next.ledger.filter((row) => ledgerStore(row, next.shifts) !== store);
  next.shifts = [...next.shifts.filter((row) => storeName(row) !== store), ...slice.shifts];
  next.sessions = [...next.sessions.filter((row) => !removeShifts.has(row.shift_id)), ...slice.sessions];
  next.sales = [...next.sales.filter((row) => !removeShifts.has(row.shift_id)), ...slice.sales];
  next.sale_lines = [...next.sale_lines.filter((row) => !removeSales.has(row.sale_id)), ...slice.sale_lines];
  next.tickets = [...next.tickets.filter((row) => !removeShifts.has(row.shift_id)), ...slice.tickets];
  next.ticket_lines = [...next.ticket_lines.filter((row) => !removeTickets.has(row.ticket_id)), ...slice.ticket_lines];
  next.counts = [...next.counts.filter((row) => !removeShifts.has(row.shift_id)), ...slice.counts];
  next.count_lines = [...next.count_lines.filter((row) => !removeCounts.has(row.count_id)), ...slice.count_lines];
  next.deposits = [...next.deposits.filter((row) => !removeShifts.has(row.shift_id)), ...slice.deposits];
  next.closings = [...next.closings.filter((row) => !removeShifts.has(row.shift_id)), ...slice.closings];
  next.closing_drafts = [...next.closing_drafts.filter((row) => !removeShifts.has(row.shift_id)), ...slice.closing_drafts];
  next.incoming = [...next.incoming.filter((row) => storeName(row) !== store), ...slice.incoming];
  next.balances = [...next.balances.filter((row) => storeName(row) !== store), ...slice.balances];
  next.ledger = [...keptLedger, ...slice.ledger];
  if (store === "PNY01") next.deposit_seq = slice.deposit_seq;
  else next.deposit_seq_pny02 = slice.deposit_seq;
  if (store === "PNY01") next.revision_pny01 = slice.slice_revision;
  else next.revision_pny02 = slice.slice_revision;
  return next;
}

function reconcile(combined: State, rows: SheetRow[]): { state: State; recovered: boolean } {
  let state = combined;
  let recovered = false;
  const p1 = parseSlice(joined(rows, "STATE_P1", "P1-"));
  const p2 = parseSlice(joined(rows, "STATE_P2", "P2-"));
  if (p1 && p1.slice_revision > (state.revision_pny01 ?? 0)) {
    state = applySlice(state, p1, "PNY01");
    recovered = true;
  }
  if (p2 && p2.slice_revision > (state.revision_pny02 ?? 0)) {
    state = applySlice(state, p2, "PNY02");
    recovered = true;
  }
  return { state, recovered };
}

/** Read the till. A stale tail chunk is ignored. Store slices win when they are newer than the combined copy. */
export function readStateFromStaff(rows: SheetRow[]): { state: State; recovered: boolean } | null {
  const parts = rows
    .filter((row) => row.record_type === "STATE" && row.row_id?.startsWith("STATE-") && row.doc)
    .sort((a, b) => (a.row_id ?? "").localeCompare(b.row_id ?? ""));
  if (parts.length > 0) {
    const direct = tryState(parts.map((row) => row.doc).join(""));
    if (direct) return reconcile(direct, rows);
    for (let count = parts.length - 1; count >= 1; count -= 1) {
      const parsed = tryState(parts.slice(0, count).map((row) => row.doc).join(""));
      if (parsed) return { ...reconcile(parsed, rows), recovered: true };
    }
  }
  const p1 = parseSlice(joined(rows, "STATE_P1", "P1-"));
  const p2 = parseSlice(joined(rows, "STATE_P2", "P2-"));
  if (!p1 && !p2) {
    if (parts.length > 0) throw new SheetUnavailable("POS sheet state could not be read.");
    return null;
  }
  let state = emptyState();
  if (p1) state = applySlice(state, p1, "PNY01");
  if (p2) state = applySlice(state, p2, "PNY02");
  return { state, recovered: true };
}

function stableSlice(state: State, store: StoreName): string {
  const slice = extractSlice(state, store);
  // A refill that is only in memory gets a new timestamp on every read.
  slice.incoming = slice.incoming.map((row) => ({ ...row, imported_at: "", created_at: row.status === "PENDING_CONFIRM" ? "" : row.created_at }));
  return JSON.stringify(slice);
}

export function touchedStores(before: State, after: State): StoreName[] {
  const stores: StoreName[] = ["PNY01", "PNY02"];
  return stores.filter((store) => stableSlice(before, store) !== stableSlice(after, store));
}

function mergeByKey<T>(fresh: T[], loaded: T[], snapshot: T[], key: (row: T) => string): T[] {
  const loadedJson = new Map(loaded.map((row) => [key(row), JSON.stringify(row)]));
  const freshMap = new Map(fresh.map((row) => [key(row), row]));
  for (const row of snapshot) {
    const id = key(row);
    const previous = loadedJson.get(id);
    if (previous === undefined || previous !== JSON.stringify(row)) freshMap.set(id, structuredClone(row));
  }
  for (const row of loaded) {
    const id = key(row);
    if (!snapshot.some((item) => key(item) === id)) freshMap.delete(id);
  }
  return [...freshMap.values()];
}

function unionBy<T>(fresh: T[], snapshot: T[], key: (row: T) => string): T[] {
  const map = new Map(fresh.map((row) => [key(row), row]));
  for (const row of snapshot) map.set(key(row), row);
  return [...map.values()];
}

/**
 * Keep a newer copy of the store this save did not touch.
 * If this save's own store changed underneath it, the caller retries instead.
 */
export function mergeWrites(fresh: State, loaded: State, snapshot: State): State {
  const touched = touchedStores(loaded, snapshot);
  let next = structuredClone(fresh) as State;
  for (const store of touched) next = applySlice(next, extractSlice(snapshot, store), store);
  next.products = mergeByKey(fresh.products, loaded.products, snapshot.products, (row) => row.sku);
  next.staff = mergeByKey(fresh.staff, loaded.staff, snapshot.staff, (row) => row.staff_uid);
  next.store_products = mergeByKey(fresh.store_products, loaded.store_products, snapshot.store_products, (row) => `${row.store_code}:${row.sku}`);
  next.stores = mergeByKey(fresh.stores, loaded.stores, snapshot.stores, (row) => row.code);
  next.stock_labels = mergeByKey(fresh.stock_labels ?? [], loaded.stock_labels ?? [], snapshot.stock_labels ?? [], (row) => row.store);
  next.idempotency = unionBy<IdemRow>(fresh.idempotency, snapshot.idempotency, (row) => `${row.scope}:${row.key}`);
  next.outbox = unionBy(fresh.outbox, snapshot.outbox, (row) => row.id);
  next.audit = unionBy(fresh.audit, snapshot.audit, (row) => row.id);
  next.admin_sessions = unionBy(fresh.admin_sessions, snapshot.admin_sessions, (row) => row.id);
  next.cursors = mergeByKey(fresh.cursors, loaded.cursors, snapshot.cursors, (row) => row.tab);
  if (!touched.includes("PNY01")) next.deposit_seq = fresh.deposit_seq;
  if (!touched.includes("PNY02")) next.deposit_seq_pny02 = fresh.deposit_seq_pny02;
  next.state_revision = (fresh.state_revision ?? 0) + 1;
  next.revision_pny01 = touched.includes("PNY01") ? (fresh.revision_pny01 ?? 0) + 1 : fresh.revision_pny01 ?? 0;
  next.revision_pny02 = touched.includes("PNY02") ? (fresh.revision_pny02 ?? 0) + 1 : fresh.revision_pny02 ?? 0;
  return next;
}

export function sameStoreConflict(loaded: State, fresh: State, touched: StoreName[]): boolean {
  return touched.some((store) => stableSlice(loaded, store) !== stableSlice(fresh, store));
}
