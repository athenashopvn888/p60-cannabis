import { STORE_CODE } from "./constants.ts";
import { SheetUnavailable } from "./errors.ts";
import { emptyState, type PosDb, type Tx } from "./memory.ts";
import { skuSortKey } from "./flowerSku.ts";
import { planPaperRefills } from "./paperRefill.ts";
import { rawPriceRows } from "./sizePrice.ts";
import { catalogFromFeed, readCommittedPnyCatalog } from "./setbFeed.ts";
import type { SheetClient, SheetTabSpec } from "./sheets.ts";
import type { IncomingRow, SheetRow, State } from "./types.ts";

/** Server-side read cache. Hidden tabs already stop polling; this keeps a warm instance off the sheet. */
export const POS_SHEET_CACHE_MS = 25_000;
const CHUNK = 30_000;

export const POS_TAB_SPECS: SheetTabSpec[] = [
  { title: "POS_Staff", headers: ["row_id", "record_type", "staff_uid", "sccx_id", "pos_id", "display_name", "active", "updated_at", "created_at", "doc"] },
  { title: "POS_Shifts", headers: ["row_id", "shift_id", "staff", "pin_hash", "expires_at", "status", "sccx_shift_id", "store_code", "ticket_letter", "started_at", "ended_at", "end_reason", "opening_confirmed_at", "doc"] },
  { title: "POS_Sales", headers: ["row_id", "sale_id", "shift_id", "staff", "payment_method", "status", "total_cents", "ref_no", "created_at", "doc"] },
  { title: "POS_Refills", headers: ["row_id", "kitchen_row_id", "batch_id", "store_code", "sku", "qty", "qty_sent", "qty_received", "kind", "status", "kitchen_status", "variance_reason", "confirmed_at", "created_at", "record_type", "doc"] },
  { title: "POS_Counts", headers: ["row_id", "count_id", "shift_id", "kind", "sku", "system_qty", "counted_qty", "variance_reason", "confirmed_at", "doc"] },
  { title: "POS_Deposits", headers: ["row_id", "shift_id", "staff", "amount_cents", "note", "created_at", "doc"] },
];

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(row: SheetRow, key: string) {
  return String(row[key] ?? "").trim();
}

function normalize(parsed: State): State {
  const base = emptyState();
  for (const key of Object.keys(base) as (keyof State)[]) {
    const value = parsed[key];
    if (Array.isArray(value)) (base[key] as unknown) = value;
  }
  if (base.stores.length === 0) base.stores = emptyState().stores;
  if (!base.closing_drafts) base.closing_drafts = [];
  if (typeof parsed.deposit_seq === "number" && Number.isInteger(parsed.deposit_seq)) base.deposit_seq = parsed.deposit_seq;
  return base;
}

function stateFromStaffRows(rows: SheetRow[]): State | null {
  const parts = rows
    .filter((row) => row.record_type === "STATE" && row.row_id?.startsWith("STATE-") && row.doc)
    .sort((a, b) => a.row_id.localeCompare(b.row_id));
  if (parts.length === 0) return null;
  try {
    return normalize(JSON.parse(parts.map((row) => row.doc).join("")) as State);
  } catch {
    throw new SheetUnavailable("POS sheet state could not be read.");
  }
}

/** Add missing catalog SKUs. Does not create on-hand. */
function mergeCatalog(state: State) {
  const at = new Date().toISOString();
  let added = 0;
  for (const product of catalogFromFeed(readCommittedPnyCatalog())) {
    if (state.products.some((row) => row.sku === product.sku)) continue;
    added += 1;
    state.products.push({
      sku: product.sku,
      sku_sort: skuSortKey(product.sku),
      name: product.name,
      category: product.category,
      default_price_cents: product.price_cents,
      image_url: product.image_url,
      setb_active: product.active,
      synced_at: at,
      created_at: at,
    });
    state.store_products.push({
      store_code: STORE_CODE,
      sku: product.sku,
      enabled: product.active,
      price_override_cents: null,
      created_at: at,
      updated_at: at,
    });
  }
  return added > 0;
}

function mergeKitchenRefills(state: State, rows: SheetRow[]) {
  const at = new Date().toISOString();
  for (const row of rows) {
    if (row.record_type === "STATE") continue;
    const id = text(row, "row_id") || text(row, "kitchen_row_id");
    if (!UUID_V4.test(id)) continue;
    const store = text(row, "store_code") || STORE_CODE;
    if (store !== STORE_CODE) continue;
    const existing = state.incoming.find((item) => item.kitchen_row_id === id);
    const cancelled = text(row, "kitchen_status").toUpperCase() === "CANCELLED";
    if (existing) {
      if (cancelled && existing.status === "PENDING_CONFIRM") {
        existing.status = "CANCELLED_BY_KITCHEN";
        existing.qty_received = 0;
        existing.confirmed_at = at;
      }
      continue;
    }
    if (row.record_type === "POS") continue;
    const qty = Number(text(row, "qty") || text(row, "qty_sent"));
    const sku = text(row, "sku");
    if (!sku || !Number.isInteger(qty) || qty <= 0) continue;
    const kind = text(row, "kind").toUpperCase() === "ALLOCATION" ? "ALLOCATION" : "REFILL";
    const incoming: IncomingRow = {
      kitchen_row_id: id,
      batch_id: text(row, "batch_id"),
      store_code: STORE_CODE,
      sku,
      qty_sent: qty,
      kind,
      kitchen_created_at: text(row, "created_at") || null,
      imported_at: at,
      status: cancelled ? "CANCELLED_BY_KITCHEN" : "PENDING_CONFIRM",
      qty_received: cancelled ? 0 : null,
      variance_reason: null,
      confirmed_shift_id: null,
      confirmed_at: cancelled ? at : null,
      linked_ledger_id: null,
      created_at: at,
    };
    state.incoming.push(incoming);
  }
}

function packState(state: State, previousParts: number): Record<string, string>[] {
  const json = JSON.stringify(state);
  const parts: Record<string, string>[] = [];
  for (let index = 0; index * CHUNK < json.length || index === 0; index += 1) {
    parts.push({
      row_id: `STATE-${String(index).padStart(3, "0")}`,
      record_type: "STATE",
      staff_uid: "",
      sccx_id: "",
      pos_id: "",
      display_name: "",
      active: "",
      updated_at: "",
      created_at: "",
      doc: json.slice(index * CHUNK, (index + 1) * CHUNK),
    });
    if ((index + 1) * CHUNK >= json.length) break;
  }
  for (let index = parts.length; index < previousParts; index += 1) {
    parts.push({
      row_id: `STATE-${String(index).padStart(3, "0")}`,
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

/**
 * POS source of truth on the PNY Mobile Inventory sheet.
 * Readable rows live on POS_Staff, POS_Shifts, POS_Sales, POS_Refills, POS_Counts, and POS_Deposits.
 * A chunked JSON copy on POS_Staff keeps sessions, tickets, and stock math across requests.
 * Reads are cached. Unchanged reads do not write. SETB tabs are never written.
 */
export class SheetDb implements PosDb {
  private tail: Promise<void> = Promise.resolve();
  private cache: { state: State; at: number } | null = null;
  private ready: Promise<void> | null = null;
  private stateParts = 0;
  private refillRaw = new Map<string, SheetRow>();
  private sheet: SheetClient;
  private cacheMs: number;
  private needsSave = false;
  private pricesAppended = false;

  constructor(sheet: SheetClient, cacheMs = POS_SHEET_CACHE_MS) {
    this.sheet = sheet;
    this.cacheMs = cacheMs;
  }

  forgetCache() {
    this.cache = null;
  }

  private async applyPaperRefills(rows: SheetRow[]) {
    const catalog = new Set(catalogFromFeed(readCommittedPnyCatalog()).map((product) => product.sku));
    const plan = planPaperRefills(rows, catalog);
    const writes = [...plan.cancel, ...plan.add];
    if (writes.length === 0) return rows;
    await this.sheet.upsert("POS_Refills", writes);
    const byId = new Map<string, SheetRow>();
    for (const row of rows) {
      const id = text(row, "row_id") || text(row, "kitchen_row_id");
      if (id) byId.set(id, row);
    }
    for (const row of writes) byId.set(row.row_id, { ...(byId.get(row.row_id) ?? {}), ...row });
    return [...byId.values()];
  }

  private async ensure() {
    if (!this.ready) {
      this.ready = this.sheet.ensureTabs(POS_TAB_SPECS).catch((error: unknown) => {
        this.ready = null;
        throw error;
      });
    }
    await this.ready;
  }

  private async load(): Promise<State> {
    if (this.cache && Date.now() - this.cache.at < this.cacheMs) return this.cache.state;
    await this.ensure();
    const [staffRows, readRefills] = await Promise.all([
      this.sheet.readRows("POS_Staff"),
      this.sheet.readRows("POS_Refills").catch((error: unknown) => {
        if (error instanceof SheetUnavailable && error.httpStatus === 400) return [] as SheetRow[];
        throw error;
      }),
    ]);
    const refillRows = this.sheet.configured ? await this.applyPaperRefills(readRefills) : readRefills;
    if (this.sheet.configured && !this.pricesAppended) {
      try {
        await this.sheet.appendRows("Items_raw_price", rawPriceRows(), "SKU");
        this.pricesAppended = true;
      } catch {
        // Quoted prices also live on the product. A price-sheet miss must not block the till.
      }
    }
    this.stateParts = staffRows.filter((row) => row.record_type === "STATE" && row.doc).length;
    this.refillRaw = new Map();
    for (const row of refillRows) {
      const id = text(row, "row_id") || text(row, "kitchen_row_id");
      if (id) this.refillRaw.set(id, { ...row });
    }
    const state = stateFromStaffRows(staffRows) ?? emptyState();
    if (mergeCatalog(state)) this.needsSave = true;
    mergeKitchenRefills(state, refillRows);
    this.cache = { state, at: Date.now() };
    return state;
  }

  private project(state: State): { tab: string; rows: Record<string, string>[] }[] {
    const staff = state.staff.map((row) => ({
      row_id: row.staff_uid,
      record_type: "STAFF",
      staff_uid: row.staff_uid,
      sccx_id: row.sccx_id,
      pos_id: row.pos_id,
      display_name: row.display_name,
      active: row.active ? "true" : "false",
      updated_at: row.updated_at,
      created_at: row.created_at,
      doc: "",
    }));
    const shifts = state.shifts.map((row) => ({
      row_id: row.id,
      shift_id: row.sccx_shift_id,
      staff: row.staff_uid,
      pin_hash: row.pin_hash ?? "",
      expires_at: row.pin_expires_at ?? "",
      status: row.status,
      sccx_shift_id: row.sccx_shift_id,
      store_code: row.store_code,
      ticket_letter: row.ticket_letter,
      started_at: row.started_at,
      ended_at: row.ended_at ?? "",
      end_reason: row.end_reason ?? "",
      opening_confirmed_at: row.opening_confirmed_at ?? "",
      doc: JSON.stringify(row),
    }));
    const sales = state.sales.map((sale) => ({
      row_id: sale.id,
      sale_id: sale.id,
      shift_id: sale.shift_id,
      staff: sale.staff_uid,
      payment_method: sale.payment_method,
      status: sale.status,
      total_cents: String(sale.total_cents),
      ref_no: sale.ref_no,
      created_at: sale.created_at,
      doc: JSON.stringify({
        sale,
        staff_name: state.staff.find((row) => row.staff_uid === sale.staff_uid)?.display_name ?? "",
        lines: state.sale_lines.filter((line) => line.sale_id === sale.id),
      }),
    }));
    const refills = state.incoming.map((row) => {
      const prior = { ...(this.refillRaw.get(row.kitchen_row_id) ?? {}) };
      delete prior._sheet_row;
      return {
        ...prior,
        row_id: row.kitchen_row_id,
        kitchen_row_id: row.kitchen_row_id,
        batch_id: row.batch_id,
        store_code: row.store_code,
        sku: row.sku,
        qty: String(row.qty_sent),
        qty_sent: String(row.qty_sent),
        qty_received: row.qty_received == null ? "" : String(row.qty_received),
        kind: row.kind,
        status: row.status,
        kitchen_status: prior.kitchen_status || (row.status === "CANCELLED_BY_KITCHEN" ? "CANCELLED" : "ACTIVE"),
        variance_reason: row.variance_reason ?? "",
        confirmed_at: row.confirmed_at ?? "",
        created_at: row.kitchen_created_at ?? row.created_at,
        record_type: "POS",
        doc: JSON.stringify(row),
      };
    });
    const counts = state.count_lines.map((line) => {
      const count = state.counts.find((row) => row.id === line.count_id);
      return {
        row_id: line.id,
        count_id: line.count_id,
        shift_id: count?.shift_id ?? "",
        kind: count?.kind ?? "",
        sku: line.sku,
        system_qty: String(line.system_qty),
        counted_qty: String(line.counted_qty),
        variance_reason: line.variance_reason ?? "",
        confirmed_at: count?.confirmed_at ?? "",
        doc: JSON.stringify(line),
      };
    });
    const deposits = state.deposits.map((row) => ({
      row_id: row.id,
      shift_id: row.shift_id,
      staff: row.staff_uid,
      amount_cents: String(row.amount_cents),
      note: row.note ?? "",
      created_at: row.created_at,
      doc: JSON.stringify(row),
    }));
    return [
      { tab: "POS_Staff", rows: [...staff, ...packState(state, this.stateParts)] },
      { tab: "POS_Shifts", rows: shifts },
      { tab: "POS_Sales", rows: sales },
      { tab: "POS_Refills", rows: refills },
      { tab: "POS_Counts", rows: counts },
      { tab: "POS_Deposits", rows: deposits },
    ];
  }

  private async save(state: State) {
    await this.ensure();
    for (const group of this.project(state)) {
      if (group.rows.length) await this.sheet.upsert(group.tab, group.rows);
    }
    this.stateParts = packState(state, 0).filter((row) => row.record_type === "STATE").length;
    for (const row of state.incoming) {
      this.refillRaw.set(row.kitchen_row_id, {
        ...(this.refillRaw.get(row.kitchen_row_id) ?? {}),
        row_id: row.kitchen_row_id,
        record_type: "POS",
        status: row.status,
      });
    }
    this.cache = { state, at: Date.now() };
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const loaded = await this.load();
      const snapshot = structuredClone(loaded) as State;
      const result = await fn({ state: snapshot });
      if (JSON.stringify(snapshot) !== JSON.stringify(loaded) || this.needsSave) {
        await this.save(snapshot);
        this.needsSave = false;
      }
      return result;
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
