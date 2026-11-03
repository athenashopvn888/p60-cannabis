import { randomUUID } from "node:crypto";
import {
  DEMO_LABEL,
  FULL_SCAN_MS,
  IMPORT_DEBOUNCE_MS,
  IMPORT_OVERLAP_ROWS,
  MAX_ORDER_LINES,
  MAX_PENDING_TICKETS,
  MAX_PIN_FAILURES,
  MENU_CACHE_MS,
  OUTBOX_ERROR_ATTEMPTS,
  OUTBOX_TAB_ORDER,
  PIN_REPLAY_TTL_MS,
  PIN_TTL_MS,
  SCCX_ACK_LATE_MS,
  SCHEMA_VERSION,
  SHEET_ALERT_MS,
  SHEET_DELAY_MS,
  STORE_CODE,
  TICKET_LETTERS,
  TICKET_TTL_MS,
} from "./constants.ts";
import { decryptJson, encryptJson, hashPin, newToken, randomPin, safeEqual, sha256, stableStringify, verifyPin } from "./crypto.ts";
import { PosError, SheetUnavailable } from "./errors.ts";
import type { PosDb } from "./memory.ts";
import { centsToSheet, formatMoney, formatStoreTime, inStockCategories } from "./money.ts";
import type { SheetClient } from "./sheets.ts";
import type {
  ClosingLine,
  ClosingRow,
  IncomingRow,
  MovementType,
  Secrets,
  ShiftRow,
  State,
  SheetRow,
} from "./types.ts";

export const END_SHIFT_MESSAGE = "Summary will post to BOT HUB within 5 min.";
const BACKOFF_MIN = [1, 2, 5, 10, 15];

type Json = Record<string, unknown>;

export type PosDeps = {
  now?: () => Date;
  sheet: SheetClient;
  secrets: Secrets;
  demo?: { pin: string; label: string } | null;
};

function iso(date: Date) {
  return date.toISOString();
}

function audit(state: State, action: string, refType: string | null, refId: string | null, actor: string | null, detail: Json, at: string) {
  state.audit.push({ id: randomUUID(), action, ref_type: refType, ref_id: refId, actor, detail, created_at: at });
}

function enqueue(state: State, tab: string, rowId: string, payload: Record<string, string>, at: string) {
  const existing = state.outbox.find((row) => row.row_id === rowId);
  if (existing) {
    existing.tab = tab;
    existing.payload = payload;
    existing.status = "queued";
    existing.sent_at = null;
    existing.attempts = 0;
    existing.last_error = null;
    existing.next_attempt_at = at;
    return;
  }
  state.outbox.push({
    id: randomUUID(),
    tab,
    row_id: rowId,
    payload,
    sent_at: null,
    attempts: 0,
    last_error: null,
    next_attempt_at: at,
    status: "queued",
    created_at: at,
  });
}

function ledger(state: State, sku: string, delta: number, movement: MovementType, refType: string | null, refId: string | null, actor: string | null, reason: string | null, shiftId: string | null, at: string) {
  const row = {
    id: randomUUID(),
    sku,
    qty_delta: delta,
    movement_type: movement,
    ref_type: refType,
    ref_id: refId,
    actor,
    reason,
    shift_id: shiftId,
    created_at: at,
  };
  state.ledger.push(row);
  return row;
}

function balanceAdd(state: State, sku: string, delta: number, at: string, create: boolean) {
  let row = state.balances.find((item) => item.sku === sku);
  if (!row) {
    if (!create || delta < 0) return null;
    row = { sku, qty: 0, updated_at: at, created_at: at };
    state.balances.push(row);
  }
  if (row.qty + delta < 0) return null;
  row.qty += delta;
  row.updated_at = at;
  return row.qty;
}

function requestHash(body: Json) {
  const copy = { ...body };
  delete copy.key;
  delete copy.token;
  delete copy.adminToken;
  return sha256(stableStringify(copy));
}

function remember(state: State, scope: string, key: string, body: Json, result: Json, now: Date, secret: string, encrypt = false) {
  const publicBody = { ...result };
  delete publicBody.pin;
  state.idempotency.push({
    scope,
    key,
    request_hash: requestHash(body),
    response_json: encrypt ? encryptJson(result, secret) : JSON.stringify(result),
    public_json: publicBody,
    status_code: 200,
    purge_at: encrypt ? iso(new Date(now.getTime() + PIN_REPLAY_TTL_MS)) : null,
    created_at: iso(now),
  });
}

function replay(state: State, scope: string, key: string, body: Json, now: Date, secret: string): Json | null {
  if (!key) throw new PosError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required.");
  const existing = state.idempotency.find((row) => row.scope === scope && row.key === key);
  if (!existing) return null;
  if (existing.request_hash !== requestHash(body)) {
    throw new PosError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used with a different request.");
  }
  if (existing.purge_at && Date.parse(existing.purge_at) <= now.getTime()) existing.response_json = null;
  if (!existing.response_json) {
    return { ...(existing.public_json as Json), ok: true, replay: true, pin: null, pin_purged: true };
  }
  const decoded = existing.response_json.startsWith("v1.")
    ? decryptJson<Json>(existing.response_json, secret)
    : (JSON.parse(existing.response_json) as Json);
  return { ...decoded, replay: true };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function shiftTotals(state: State, shiftId: string) {
  const sales = state.sales.filter((sale) => sale.shift_id === shiftId && sale.status === "COMPLETED");
  const voids = state.sales.filter((sale) => sale.shift_id === shiftId && sale.status === "VOIDED");
  const deposits = state.deposits.filter((deposit) => deposit.shift_id === shiftId);
  const salesTotal = sales.reduce((sum, sale) => sum + sale.total_cents, 0);
  const deposited = deposits.reduce((sum, deposit) => sum + deposit.amount_cents, 0);
  return {
    sales_total_cents: salesTotal,
    sale_count: sales.length,
    void_count: voids.length,
    deposited_cents: deposited,
    cash_on_hand_cents: salesTotal - deposited,
  };
}

function ticketStats(state: State, shiftId: string) {
  const rows = state.tickets.filter((ticket) => ticket.shift_id === shiftId);
  return {
    total: rows.length,
    cashed: rows.filter((ticket) => ticket.status === "CASHED_OUT").length,
    expired: rows.filter((ticket) => ticket.status === "EXPIRED").length,
  };
}

function productName(state: State, sku: string) {
  return state.products.find((product) => product.sku === sku)?.name ?? sku;
}

function priceOf(state: State, sku: string) {
  const product = state.products.find((item) => item.sku === sku);
  const storeProduct = state.store_products.find((item) => item.store_code === STORE_CODE && item.sku === sku);
  if (!product?.setb_active || !storeProduct?.enabled) throw new PosError(409, "NOT_SELLABLE", "That item is not for sale.");
  if (storeProduct.price_override_cents != null) return { cents: storeProduct.price_override_cents, source: "STORE_OVERRIDE", product };
  return { cents: product.default_price_cents, source: "SETB_DEFAULT", product };
}

function qtyOf(state: State, sku: string) {
  return state.balances.find((row) => row.sku === sku)?.qty ?? 0;
}

function countSkus(state: State) {
  const skus = new Set<string>();
  for (const balance of state.balances) skus.add(balance.sku);
  for (const product of state.products) {
    const storeProduct = state.store_products.find((item) => item.store_code === STORE_CODE && item.sku === product.sku);
    if (product.setb_active && storeProduct?.enabled) skus.add(product.sku);
  }
  return [...skus].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function revokeSessions(state: State, shiftId: string, at: string) {
  for (const session of state.sessions) {
    if (session.shift_id === shiftId && !session.revoked_at) session.revoked_at = at;
  }
}

function expireTickets(state: State, atMs: number, shiftId?: string) {
  let expired = 0;
  for (const ticket of state.tickets) {
    if (shiftId && ticket.shift_id !== shiftId) continue;
    if ((ticket.status === "PENDING" || ticket.status === "OPEN") && Date.parse(ticket.expires_at) <= atMs) {
      ticket.status = "EXPIRED";
      expired += 1;
    }
  }
  return expired;
}

function summaryText(shift: ShiftRow, staffPos: string, closing: Omit<ClosingRow, "summary_text">) {
  const left = [...closing.closing_lines].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
  const shown = left.slice(0, 15).map((line) => `${line.sku} ${line.name} ${line.left}`).join(" · ");
  const more = left.length > 15 ? " · (top 15, full list in sheet)" : "";
  return [
    `PNY01 shift closed – ${staffPos} ${formatStoreTime(shift.started_at)}–${formatStoreTime(shift.ended_at ?? closing.created_at)} (America/Toronto)`,
    `Sales: ${formatMoney(closing.sales_total_cents)} (${closing.sale_count} sales, ${closing.void_count} void) · COH: ${formatMoney(closing.cash_on_hand_cents)} · Deposited: ${formatMoney(closing.deposited_cents)}`,
    `Tickets: ${closing.tickets_total} (${closing.tickets_cashed_out} cashed, ${closing.tickets_expired} expired)`,
    `Left: ${shown}${more}`,
    closing.no_count ? "No count taken" : "",
  ].filter(Boolean).join("\n");
}

function buildClosing(state: State, shift: ShiftRow, lines: ClosingLine[], noCount: boolean, at: string): ClosingRow {
  const totals = shiftTotals(state, shift.id);
  const tickets = ticketStats(state, shift.id);
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  const base = {
    shift_id: shift.id,
    sales_total_cents: totals.sales_total_cents,
    sale_count: totals.sale_count,
    void_count: totals.void_count,
    cash_on_hand_cents: totals.cash_on_hand_cents,
    deposited_cents: totals.deposited_cents,
    tickets_total: tickets.total,
    tickets_cashed_out: tickets.cashed,
    tickets_expired: tickets.expired,
    closing_lines: lines,
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: noCount,
    created_at: at,
  };
  return { ...base, summary_text: summaryText({ ...shift, ended_at: shift.ended_at ?? at }, staff?.pos_id ?? "", base) };
}

function finishShift(state: State, shift: ShiftRow, reason: string, at: string, closing: ClosingRow) {
  expireTickets(state, Date.parse(at), shift.id);
  const fresh = buildClosing(state, shift, closing.closing_lines, closing.no_count, at);
  shift.status = "ENDED";
  shift.ended_at = at;
  shift.end_reason = reason;
  shift.pin_hash = null;
  shift.pin_expires_at = at;
  revokeSessions(state, shift.id, at);
  fresh.summary_text = summaryText(shift, state.staff.find((row) => row.staff_uid === shift.staff_uid)?.pos_id ?? "", fresh);
  if (!state.closings.some((row) => row.shift_id === shift.id)) state.closings.push(fresh);
  return fresh;
}

function noCountLines(state: State): ClosingLine[] {
  return countSkus(state).map((sku) => ({ sku, name: productName(state, sku), left: qtyOf(state, sku), system_qty: qtyOf(state, sku) }));
}

function queueClosingSheets(state: State, shift: ShiftRow, closing: ClosingRow, at: string) {
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  for (const line of closing.closing_lines) {
    enqueue(state, "S_ClosingCounts", `CC-${shift.id}-${line.sku}`, {
      row_id: `CC-${shift.id}-${line.sku}`,
      store_code: STORE_CODE,
      shift_id: shift.sccx_shift_id,
      sku: line.sku,
      system_qty: String(line.system_qty),
      left_qty: String(line.left),
      at,
    }, at);
  }
  enqueue(state, "S_ShiftSummary", `SS-${shift.id}`, {
    row_id: `SS-${shift.id}`,
    store_code: STORE_CODE,
    shift_id: shift.sccx_shift_id,
    staff_pos_id: staff?.pos_id ?? "",
    start: shift.started_at,
    end: shift.ended_at ?? at,
    sales_total: centsToSheet(closing.sales_total_cents),
    sale_count: String(closing.sale_count),
    voids: String(closing.void_count),
    cash_on_hand: centsToSheet(closing.cash_on_hand_cents),
    deposited: centsToSheet(closing.deposited_cents),
    tickets: String(closing.tickets_total),
    no_count: closing.no_count ? "true" : "false",
  }, at);
  queueSnapshot(state, at);
}

function queueSnapshot(state: State, at: string) {
  for (const product of state.products) {
    const storeProduct = state.store_products.find((item) => item.store_code === STORE_CODE && item.sku === product.sku);
    enqueue(state, "Products", `P-${product.sku}`, {
      row_id: `P-${product.sku}`,
      sku: product.sku,
      name: product.name,
      category: product.category,
      active: product.setb_active && storeProduct?.enabled ? "true" : "false",
    }, at);
    enqueue(state, "S_Stock", `ST-${STORE_CODE}-${product.sku}`, {
      row_id: `ST-${STORE_CODE}-${product.sku}`,
      store_code: STORE_CODE,
      sku: product.sku,
      name: product.name,
      on_hand: String(qtyOf(state, product.sku)),
      updated_at: at,
    }, at);
  }
  enqueue(state, "_Meta", "META-PNY", {
    row_id: "META-PNY",
    app: "PNY",
    last_write_at: at,
    schema_version: SCHEMA_VERSION,
  }, at);
}

function receiptPayload(row: IncomingRow, shiftSccx: string, staffPos: string): Record<string, string> {
  const received = row.qty_received;
  const status = row.status === "CANCELLED_BY_KITCHEN" ? "CANCEL_ACK" : row.status === "PENDING_CONFIRM" ? "IMPORTED" : row.status;
  return {
    row_id: `R-${row.kitchen_row_id}`,
    kitchen_row_id: row.kitchen_row_id,
    store_code: STORE_CODE,
    sku: row.sku,
    qty_sent: String(row.qty_sent),
    qty_received: received == null ? "" : String(received),
    variance: received == null ? "" : String(received - row.qty_sent),
    variance_reason: row.variance_reason ?? "",
    status,
    shift_id: shiftSccx,
    staff_pos_id: staffPos,
    confirmed_at: row.confirmed_at ?? "",
  };
}

function openShifts(state: State) {
  return state.shifts.filter((shift) => shift.store_code === STORE_CODE && shift.status !== "ENDED");
}

function requireSession(state: State, token: string, now: Date) {
  const session = state.sessions.find((row) => row.token_hash === sha256(token) && !row.revoked_at && Date.parse(row.expires_at) > now.getTime());
  if (!session) throw new PosError(401, "NO_SESSION", "Sign in again.");
  const shift = state.shifts.find((row) => row.id === session.shift_id);
  if (!shift || (shift.status !== "ACTIVE" && shift.status !== "CLOSING")) throw new PosError(401, "NO_SESSION", "This shift has ended.");
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  if (!staff?.active) throw new PosError(401, "NO_SESSION", "Staff record is inactive.");
  return { session, shift, staff };
}

function requireAdmin(state: State, token: string, now: Date) {
  const session = state.admin_sessions.find((row) => row.token_hash === sha256(token) && Date.parse(row.expires_at) > now.getTime());
  if (!session) throw new PosError(403, "ADMIN_ONLY", "Admin sign-in is required.");
  return session;
}

function sellingBlocked(state: State, shift: ShiftRow) {
  if (shift.status !== "ACTIVE") return "SHIFT_NOT_ACTIVE";
  if (!shift.opening_confirmed_at) return "OPENING_REQUIRED";
  if (state.incoming.some((row) => row.status === "PENDING_CONFIRM")) return "REFILL_REQUIRED";
  return null;
}

function mergeLines(lines: { sku?: string; qty?: number }[]) {
  if (lines.length > MAX_ORDER_LINES) throw new PosError(400, "TOO_MANY_LINES", "An order can have at most 10 lines.");
  const map = new Map<string, number>();
  for (const line of lines) {
    const sku = String(line.sku ?? "").trim();
    const qty = line.qty;
    if (!sku || !Number.isInteger(qty) || (qty ?? 0) <= 0 || (qty ?? 0) > 99) {
      throw new PosError(400, "BAD_QTY", "Each line needs a SKU and a quantity from 1 to 99.");
    }
    map.set(sku, (map.get(sku) ?? 0) + (qty as number));
  }
  if (map.size === 0) throw new PosError(400, "EMPTY_CART", "Add at least one item.");
  for (const qty of map.values()) if (qty > 99) throw new PosError(400, "BAD_QTY", "Each item can be at most 99.");
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([sku, qty]) => ({ sku, qty }));
}

export function reconcile(state: State) {
  const skus = new Set<string>([...state.balances.map((row) => row.sku), ...state.ledger.map((row) => row.sku)]);
  const rows = [...skus].sort().map((sku) => {
    const entries = state.ledger.filter((row) => row.sku === sku);
    const sum = (type: MovementType) => entries.filter((row) => row.movement_type === type).reduce((total, row) => total + row.qty_delta, 0);
    const parts = {
      opening: sum("OPENING_BALANCE"),
      incoming: sum("INCOMING_CONFIRM"),
      sales: sum("SALE"),
      voids: sum("VOID"),
      adjustments: sum("ADJUSTMENT") + sum("COUNT_VARIANCE"),
    };
    const formula = parts.opening + parts.incoming + parts.sales + parts.voids + parts.adjustments;
    const balance = state.balances.find((row) => row.sku === sku)?.qty ?? 0;
    const ledgerSum = entries.reduce((total, row) => total + row.qty_delta, 0);
    return { sku, balance, ledger_sum: ledgerSum, formula, ...parts, ok: ledgerSum === balance && formula === balance && balance >= 0 };
  });
  const shifts = state.shifts.map((shift) => {
    const totals = shiftTotals(state, shift.id);
    return { shift_id: shift.id, ...totals, cash_ok: totals.sales_total_cents - totals.deposited_cents === totals.cash_on_hand_cents };
  });
  return { ok: rows.every((row) => row.ok) && shifts.every((shift) => shift.cash_ok), skus: rows, shifts, cash_ok: shifts.every((shift) => shift.cash_ok) };
}

function salePayload(state: State, saleId: string) {
  const sale = state.sales.find((row) => row.id === saleId);
  if (!sale) return;
  const shift = state.shifts.find((row) => row.id === sale.shift_id);
  const staff = state.staff.find((row) => row.staff_uid === sale.staff_uid);
  const lines = state.sale_lines.filter((row) => row.sale_id === sale.id);
  return {
    row_id: `S-${sale.id}`,
    sale_id: sale.id,
    ref_no: sale.ref_no,
    store_code: STORE_CODE,
    shift_id: shift?.sccx_shift_id ?? "",
    staff_pos_id: staff?.pos_id ?? "",
    total: centsToSheet(sale.total_cents),
    lines: lines.map((line) => `${line.sku}x${line.qty}@${centsToSheet(line.unit_price_cents)}`).join(" | "),
    status: sale.status,
    prices_tax_included: sale.prices_tax_included ? "true" : "false",
    payment_method: sale.payment_method,
    at: sale.created_at,
  };
}

export class PosService {
  private menuCache: { gen: number; at: number; body: Json } | null = null;
  private menuGen = 0;
  private hits = new Map<string, number[]>();
  private db: PosDb;
  private deps: PosDeps;

  constructor(db: PosDb, deps: PosDeps) {
    this.db = db;
    this.deps = deps;
  }

  private now() {
    return this.deps.now?.() ?? new Date();
  }

  private bumpMenu() {
    this.menuGen += 1;
    this.menuCache = null;
  }

  private hit(bucket: string, limit: number, windowMs: number) {
    const now = this.now().getTime();
    const recent = (this.hits.get(bucket) ?? []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= limit) {
      this.hits.set(bucket, recent);
      throw new PosError(429, "RATE_LIMITED", "Too many attempts. Wait a moment and try again.");
    }
    recent.push(now);
    this.hits.set(bucket, recent);
  }

  bootstrap() {
    return {
      ok: true,
      store: STORE_CODE,
      demo: Boolean(this.deps.demo),
      demo_label: this.deps.demo?.label ?? null,
      demo_pin: this.deps.demo?.pin ?? null,
    };
  }

  async startShift(input: { key: string; store?: string; staff_ref?: string; pos_id?: string; shift_id?: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "shift_start", input.key, body, now, this.deps.secrets.shift);
      if (seen) return seen;
      if ((input.store ?? STORE_CODE) !== STORE_CODE) throw new PosError(404, "STORE", "This till is PNY01 only.");
      const staff = tx.state.staff.find((row) => row.staff_uid === input.staff_ref || row.sccx_id === input.staff_ref);
      if (!staff?.active) throw new PosError(403, "STAFF_INACTIVE", "Staff is not active.");
      if (!input.shift_id) throw new PosError(400, "SHIFT_ID", "shift_id is required.");
      if (tx.state.shifts.some((shift) => shift.sccx_shift_id === input.shift_id)) throw new PosError(409, "SHIFT_EXISTS", "That shift already exists.");
      if (input.pos_id) {
        staff.pos_id = input.pos_id;
        staff.updated_at = iso(now);
      }
      const at = iso(now);
      for (const previous of openShifts(tx.state)) {
        const closing = buildClosing(tx.state, previous, noCountLines(tx.state), true, at);
        finishShift(tx.state, previous, "REPLACED", at, closing);
        queueClosingSheets(tx.state, previous, tx.state.closings.find((row) => row.shift_id === previous.id) ?? closing, at);
      }
      const store = tx.state.stores.find((row) => row.code === STORE_CODE);
      if (!store) throw new PosError(404, "STORE", "Store is missing.");
      const letter = TICKET_LETTERS[store.ticket_letter_seq % TICKET_LETTERS.length];
      store.ticket_letter_seq += 1;
      const pin = randomPin();
      const shift: ShiftRow = {
        id: randomUUID(),
        sccx_shift_id: input.shift_id,
        staff_uid: staff.staff_uid,
        store_code: STORE_CODE,
        ticket_letter: letter,
        ticket_seq: 0,
        pin_hash: hashPin(pin),
        pin_expires_at: iso(new Date(now.getTime() + PIN_TTL_MS)),
        pin_failed_attempts: 0,
        status: "ACTIVE",
        started_at: at,
        ended_at: null,
        end_reason: null,
        opening_confirmed_at: null,
        refill_confirmed_at: null,
        created_at: at,
      };
      tx.state.shifts.push(shift);
      const result = {
        ok: true,
        staff_name: staff.display_name,
        pin,
        expires_at: shift.pin_expires_at,
        ticket_letter: letter,
        shift_id: shift.id,
        sccx_shift_id: shift.sccx_shift_id,
      };
      remember(tx.state, "shift_start", input.key, body, result, now, this.deps.secrets.shift, true);
      audit(tx.state, "SHIFT_START", "shift", shift.id, staff.staff_uid, { sccx_shift_id: shift.sccx_shift_id, ticket_letter: letter }, at);
      return result;
    });
  }

  async endShiftFromSccx(input: { key: string; store?: string; shift_id?: string; reason?: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "shift_end", input.key, body, now, this.deps.secrets.shift);
      if (seen) return seen;
      if ((input.store ?? STORE_CODE) !== STORE_CODE) throw new PosError(404, "STORE", "This till is PNY01 only.");
      const shift = tx.state.shifts.find((row) => row.sccx_shift_id === input.shift_id || row.id === input.shift_id);
      if (!shift) throw new PosError(404, "SHIFT", "Shift was not found.");
      const at = iso(now);
      if (shift.status !== "ENDED") {
        const reason = input.reason === "SCCX_AUTOCLOSE" ? "SCCX_AUTOCLOSE" : "SCCX_OFF";
        expireTickets(tx.state, now.getTime(), shift.id);
        const closing = buildClosing(tx.state, shift, noCountLines(tx.state), true, at);
        finishShift(tx.state, shift, reason, at, closing);
        const saved = tx.state.closings.find((row) => row.shift_id === shift.id) ?? closing;
        queueClosingSheets(tx.state, shift, saved, at);
      }
      const closing = tx.state.closings.find((row) => row.shift_id === shift.id);
      const result = { ok: true, end_reason: shift.end_reason, no_count: closing?.no_count ?? true, shift_id: shift.sccx_shift_id, message: "PIN cleared." };
      remember(tx.state, "shift_end", input.key, body, result, now, this.deps.secrets.shift);
      return result;
    });
  }

  async login(pin: string, ip: string) {
    this.hit(`login:${ip || "unknown"}`, 20, 15 * 60 * 1000);
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      for (const shift of openShifts(tx.state)) {
        if (shift.pin_expires_at && Date.parse(shift.pin_expires_at) <= now.getTime()) {
          const closing = buildClosing(tx.state, shift, noCountLines(tx.state), true, at);
          finishShift(tx.state, shift, "EXPIRED", at, closing);
        }
      }
      const shift = tx.state.shifts.find((row) => row.store_code === STORE_CODE && (row.status === "ACTIVE" || row.status === "CLOSING" || row.status === "LOCKED"));
      if (!shift) return { ok: false as const, status: 401, code: "NO_SHIFT", message: "No shift is active." };
      if (shift.status === "LOCKED") return { ok: false as const, status: 423, code: "LOCKED", message: "Shift is locked. An admin must reissue the PIN." };
      if (!shift.pin_hash || !shift.pin_expires_at || Date.parse(shift.pin_expires_at) <= now.getTime()) {
        return { ok: false as const, status: 401, code: "PIN_EXPIRED", message: "That PIN has expired." };
      }
      if (!/^\d{6}$/.test(pin) || !verifyPin(pin, shift.pin_hash)) {
        shift.pin_failed_attempts += 1;
        if (shift.pin_failed_attempts >= MAX_PIN_FAILURES) shift.status = "LOCKED";
        return {
          ok: false as const,
          status: shift.status === "LOCKED" ? 423 : 401,
          code: shift.status === "LOCKED" ? "LOCKED" : "BAD_PIN",
          message: shift.status === "LOCKED" ? "Shift is locked. An admin must reissue the PIN." : "That PIN is not correct.",
        };
      }
      shift.pin_failed_attempts = 0;
      const token = newToken();
      tx.state.sessions.push({
        id: randomUUID(),
        shift_id: shift.id,
        token_hash: sha256(token),
        expires_at: shift.pin_expires_at,
        revoked_at: null,
        created_at: at,
      });
      const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
      return { ok: true as const, token, staff_name: staff?.display_name ?? "", pos_id: staff?.pos_id ?? "" };
    });
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    return result;
  }

  async logout(token: string) {
    await this.db.transaction(async (tx) => {
      const session = tx.state.sessions.find((row) => row.token_hash === sha256(token) && !row.revoked_at);
      if (session) session.revoked_at = iso(this.now());
    });
    return { ok: true };
  }

  async state(token: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      expireTickets(tx.state, now.getTime());
      const { shift, staff } = requireSession(tx.state, token, now);
      const totals = shiftTotals(tx.state, shift.id);
      const products = tx.state.products
        .filter((product) => product.setb_active)
        .flatMap((product) => {
          const storeProduct = tx.state.store_products.find((item) => item.store_code === STORE_CODE && item.sku === product.sku);
          if (!storeProduct?.enabled) return [];
          const price = storeProduct.price_override_cents ?? product.default_price_cents;
          return [{ sku: product.sku, sku_sort: product.sku_sort, name: product.name, category: product.category, price_cents: price, qty: qtyOf(tx.state, product.sku) }];
        })
        .sort((a, b) => a.sku_sort - b.sku_sort || a.sku.localeCompare(b.sku));
      const incoming = tx.state.incoming
        .filter((row) => row.status === "PENDING_CONFIRM")
        .map((row) => ({ kitchen_row_id: row.kitchen_row_id, sku: row.sku, name: productName(tx.state, row.sku), qty_sent: row.qty_sent, kind: row.kind }));
      const tickets = tx.state.tickets
        .filter((ticket) => ticket.shift_id === shift.id && (ticket.status === "PENDING" || ticket.status === "OPEN"))
        .map((ticket) => ({
          id: ticket.id,
          code: ticket.code,
          status: ticket.status,
          expires_at: ticket.expires_at,
          lines: tx.state.ticket_lines.filter((line) => line.ticket_id === ticket.id).map((line) => ({
            sku: line.sku,
            name: productName(tx.state, line.sku),
            qty: line.qty,
          })),
        }));
      const pendingCount = tickets.filter((ticket) => ticket.status === "PENDING").length;
      const phase = shift.status === "CLOSING" ? "end" : !shift.opening_confirmed_at ? "opening" : incoming.length ? "refill" : "sell";
      const oldestQueued = tx.state.outbox
        .filter((row) => row.status === "queued")
        .map((row) => Date.parse(row.created_at))
        .sort((a, b) => a - b)[0];
      return {
        ok: true,
        demo: Boolean(this.deps.demo),
        demo_label: this.deps.demo ? DEMO_LABEL : null,
        sheet_configured: this.deps.sheet.configured,
        phase,
        can_sell: sellingBlocked(tx.state, shift) == null,
        block: sellingBlocked(tx.state, shift),
        shift: {
          id: shift.id,
          sccx_shift_id: shift.sccx_shift_id,
          staff_name: staff.display_name,
          pos_id: staff.pos_id,
          ticket_letter: shift.ticket_letter,
          status: shift.status,
          opening_confirmed: Boolean(shift.opening_confirmed_at),
          pin_expires_at: shift.pin_expires_at,
        },
        totals: {
          sales_cents: totals.sales_total_cents,
          cash_on_hand_cents: totals.cash_on_hand_cents,
          deposited_cents: totals.deposited_cents,
        },
        categories: inStockCategories(products),
        products,
        count_lines: countSkus(tx.state).map((sku) => ({ sku, name: productName(tx.state, sku), system_qty: qtyOf(tx.state, sku) })),
        incoming,
        tickets,
        pending_count: pendingCount,
        sheet_sync_delayed: oldestQueued != null && now.getTime() - oldestQueued >= SHEET_DELAY_MS,
        prices_include_tax: true,
        end_shift_message: END_SHIFT_MESSAGE,
      };
    });
  }

  async openingCount(token: string, input: { key: string; lines: { sku: string; counted_qty: number; variance_reason?: string }[] }) {
    const body = input as unknown as Json;
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "opening_count", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const { shift, staff } = requireSession(tx.state, token, now);
      if (shift.status !== "ACTIVE") throw new PosError(409, "SHIFT_NOT_ACTIVE", "Shift is not open.");
      if (shift.opening_confirmed_at) throw new PosError(409, "OPENING_DONE", "Opening count is already confirmed.");
      const expected = countSkus(tx.state);
      const bySku = new Map(input.lines.map((line) => [line.sku, line]));
      if (expected.some((sku) => !bySku.has(sku))) throw new PosError(400, "INCOMPLETE_COUNT", "Count every SKU.");
      const at = iso(now);
      const countId = randomUUID();
      for (const sku of expected) {
        const line = bySku.get(sku)!;
        if (!Number.isInteger(line.counted_qty) || line.counted_qty < 0) throw new PosError(400, "BAD_QTY", "Counted quantity must be a whole number.");
        const system = qtyOf(tx.state, sku);
        if (line.counted_qty !== system && !line.variance_reason?.trim()) {
          throw new PosError(400, "REASON_REQUIRED", "A variance needs a reason.");
        }
      }
      tx.state.counts.push({ id: countId, shift_id: shift.id, kind: "OPENING", confirmed_at: at, created_at: at });
      for (const sku of expected) {
        const line = bySku.get(sku)!;
        const system = qtyOf(tx.state, sku);
        const delta = line.counted_qty - system;
        tx.state.count_lines.push({ id: randomUUID(), count_id: countId, sku, system_qty: system, counted_qty: line.counted_qty, variance_reason: line.variance_reason?.trim() || null });
        if (delta !== 0) {
          const next = balanceAdd(tx.state, sku, delta, at, true);
          if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Count would take stock below zero.");
          ledger(tx.state, sku, delta, "COUNT_VARIANCE", "stock_count", countId, staff.staff_uid, line.variance_reason?.trim() || null, shift.id, at);
        }
        enqueue(tx.state, "S_OpeningCounts", `OC-${shift.id}-${sku}`, {
          row_id: `OC-${shift.id}-${sku}`,
          store_code: STORE_CODE,
          shift_id: shift.sccx_shift_id,
          sku,
          system_qty: String(system),
          counted_qty: String(line.counted_qty),
          variance: String(line.counted_qty - system),
          reason: line.variance_reason?.trim() || "",
          at,
        }, at);
      }
      shift.opening_confirmed_at = at;
      const resultBody = { ok: true, opening_confirmed_at: at };
      remember(tx.state, "opening_count", input.key, body, resultBody, now, this.deps.secrets.session);
      return resultBody;
    });
    this.bumpMenu();
    return result;
  }

  async confirmIncoming(token: string, input: { key: string; lines: { kitchen_row_id: string; qty_received: number; variance_reason?: string }[] }) {
    const body = input as unknown as Json;
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "incoming_confirm", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const { shift, staff } = requireSession(tx.state, token, now);
      if (!shift.opening_confirmed_at) throw new PosError(409, "OPENING_REQUIRED", "Confirm the opening count first.");
      if (input.lines.length === 0) throw new PosError(400, "EMPTY", "Nothing to confirm.");
      const at = iso(now);
      for (const line of input.lines) {
        const row = tx.state.incoming.find((item) => item.kitchen_row_id === line.kitchen_row_id);
        if (!row || row.status !== "PENDING_CONFIRM") throw new PosError(409, "ALREADY_CONFIRMED", "That incoming row is not waiting.");
        if (!Number.isInteger(line.qty_received) || line.qty_received < 0) throw new PosError(400, "BAD_QTY", "Received quantity must be a whole number.");
        if (line.qty_received !== row.qty_sent && !line.variance_reason?.trim()) throw new PosError(400, "REASON_REQUIRED", "A difference needs a reason.");
      }
      for (const line of input.lines) {
        const row = tx.state.incoming.find((item) => item.kitchen_row_id === line.kitchen_row_id)!;
        row.qty_received = line.qty_received;
        row.variance_reason = line.variance_reason?.trim() || null;
        row.confirmed_at = at;
        row.confirmed_shift_id = shift.id;
        row.status = line.qty_received === 0 ? "REJECTED" : line.qty_received === row.qty_sent ? "CONFIRMED" : "PARTIAL";
        if (line.qty_received > 0) {
          const next = balanceAdd(tx.state, row.sku, line.qty_received, at, true);
          if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not receive stock.");
          ledger(tx.state, row.sku, line.qty_received, "INCOMING_CONFIRM", "incoming", row.kitchen_row_id, staff.staff_uid, row.variance_reason, shift.id, at);
        }
        enqueue(tx.state, "S_Receipts", `R-${row.kitchen_row_id}`, receiptPayload(row, shift.sccx_shift_id, staff.pos_id), at);
      }
      if (!tx.state.incoming.some((row) => row.status === "PENDING_CONFIRM")) shift.refill_confirmed_at = at;
      const resultBody = { ok: true };
      remember(tx.state, "incoming_confirm", input.key, body, resultBody, now, this.deps.secrets.session);
      return resultBody;
    });
    this.bumpMenu();
    return result;
  }

  async cashout(token: string, input: { key: string; lines: { sku: string; qty: number; unit_price_cents?: number }[]; ticket_id?: string | null }) {
    const body = input as unknown as Json;
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "cashout", input.key, body, now, this.deps.secrets.session);
      if (seen) return { committed: true, stockout: false, body: seen };
      const { shift, staff } = requireSession(tx.state, token, now);
      const block = sellingBlocked(tx.state, shift);
      if (block === "OPENING_REQUIRED") throw new PosError(409, block, "Confirm the opening count before selling.");
      if (block === "REFILL_REQUIRED") throw new PosError(409, block, "Confirm incoming stock before selling.");
      if (block) throw new PosError(409, block, "Shift is not open for sales.");
      const at = iso(now);
      if (input.ticket_id) {
        const ticket = tx.state.tickets.find((row) => row.id === input.ticket_id && row.shift_id === shift.id);
        if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
        if (ticket.status === "EXPIRED" || Date.parse(ticket.expires_at) <= now.getTime()) {
          ticket.status = "EXPIRED";
          return { committed: true, stockout: false, body: null, error: new PosError(409, "TICKET_EXPIRED", "That ticket has expired.") };
        }
        if (ticket.status !== "PENDING" && ticket.status !== "OPEN") throw new PosError(409, "BAD_TICKET", "That ticket is not open.");
      }
      const lines = mergeLines(input.lines);
      const priced = lines.map((line) => {
        const price = priceOf(tx.state, line.sku);
        return { ...line, ...price, line_total_cents: price.cents * line.qty };
      });
      let stockout = false;
      const saleId = randomUUID();
      for (const line of priced) {
        const next = balanceAdd(tx.state, line.sku, -line.qty, at, false);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Not enough stock.");
        if (next === 0) stockout = true;
        ledger(tx.state, line.sku, -line.qty, "SALE", "sale", saleId, staff.staff_uid, null, shift.id, at);
      }
      const total = priced.reduce((sum, line) => sum + line.line_total_cents, 0);
      const ref = `PNY01-${String(tx.state.sales.length + 1).padStart(5, "0")}`;
      tx.state.sales.push({
        id: saleId,
        ref_no: ref,
        shift_id: shift.id,
        staff_uid: staff.staff_uid,
        ticket_id: input.ticket_id ?? null,
        total_cents: total,
        prices_tax_included: true,
        payment_method: "CASH",
        status: "COMPLETED",
        void_reason: null,
        voided_by: null,
        created_at: at,
      });
      for (const line of priced) {
        tx.state.sale_lines.push({
          id: randomUUID(),
          sale_id: saleId,
          sku: line.sku,
          qty: line.qty,
          unit_price_cents: line.cents,
          price_source: line.source,
          line_total_cents: line.line_total_cents,
        });
      }
      if (input.ticket_id) {
        const ticket = tx.state.tickets.find((row) => row.id === input.ticket_id);
        if (ticket) ticket.status = "CASHED_OUT";
      }
      const payload = salePayload(tx.state, saleId);
      if (payload) enqueue(tx.state, "S_Sales", payload.row_id, payload, at);
      const resultBody = {
        ok: true,
        sale_id: saleId,
        ref_no: ref,
        total_cents: total,
        prices_tax_included: true,
        lines: priced.map((line) => ({ sku: line.sku, qty: line.qty, unit_price_cents: line.cents, line_total_cents: line.line_total_cents })),
      };
      remember(tx.state, "cashout", input.key, body, resultBody, now, this.deps.secrets.session);
      return { committed: true, stockout, body: resultBody };
    });
    if ("error" in result && result.error) throw result.error;
    if (result.stockout) this.bumpMenu();
    return result.body;
  }

  async deposit(token: string, input: { key: string; amount_cents: number; note?: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "deposit", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const { shift, staff } = requireSession(tx.state, token, now);
      if (shift.status !== "ACTIVE" || !shift.opening_confirmed_at) throw new PosError(409, "SHIFT_NOT_ACTIVE", "Deposits need an open, counted shift.");
      if (!Number.isInteger(input.amount_cents) || input.amount_cents <= 0) throw new PosError(400, "BAD_AMOUNT", "Enter a deposit greater than zero.");
      const totals = shiftTotals(tx.state, shift.id);
      if (input.amount_cents > totals.cash_on_hand_cents) throw new PosError(409, "OVER_COH", "Deposit is above cash on hand.");
      const at = iso(now);
      tx.state.deposits.push({ id: randomUUID(), shift_id: shift.id, staff_uid: staff.staff_uid, amount_cents: input.amount_cents, note: input.note?.trim() || null, created_at: at });
      const next = shiftTotals(tx.state, shift.id);
      const result = { ok: true, ...next, sales_cents: next.sales_total_cents };
      remember(tx.state, "deposit", input.key, body, result, now, this.deps.secrets.session);
      return result;
    });
  }

  async openTicket(token: string, ticketId: string) {
    return this.db.transaction(async (tx) => {
      const { shift } = requireSession(tx.state, token, this.now());
      const ticket = tx.state.tickets.find((row) => row.id === ticketId && row.shift_id === shift.id);
      if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
      if (ticket.status !== "PENDING" && ticket.status !== "OPEN") throw new PosError(409, "BAD_TICKET", "That ticket cannot be opened.");
      ticket.status = "OPEN";
      return {
        ok: true,
        ticket: {
          id: ticket.id,
          code: ticket.code,
          lines: tx.state.ticket_lines.filter((line) => line.ticket_id === ticket.id).map((line) => ({ sku: line.sku, qty: line.qty })),
        },
      };
    });
  }

  async cancelTicket(token: string, ticketId: string) {
    return this.db.transaction(async (tx) => {
      const { shift } = requireSession(tx.state, token, this.now());
      const ticket = tx.state.tickets.find((row) => row.id === ticketId && row.shift_id === shift.id);
      if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
      if (ticket.status !== "PENDING" && ticket.status !== "OPEN") throw new PosError(409, "BAD_TICKET", "That ticket cannot be cancelled.");
      ticket.status = "CANCELLED";
      return { ok: true };
    });
  }

  async beginClose(token: string) {
    return this.db.transaction(async (tx) => {
      const { shift } = requireSession(tx.state, token, this.now());
      if (shift.status === "ACTIVE") shift.status = "CLOSING";
      if (shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      return { ok: true, status: shift.status, message: END_SHIFT_MESSAGE };
    });
  }

  async endShiftFromPos(token: string, input: { key: string; lines: { sku: string; counted_qty: number; variance_reason?: string }[] }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "pos_end", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const { shift } = requireSession(tx.state, token, now);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      const expected = countSkus(tx.state);
      const bySku = new Map(input.lines.map((line) => [line.sku, line]));
      if (expected.some((sku) => !bySku.has(sku))) throw new PosError(400, "INCOMPLETE_COUNT", "Count what is left of every SKU.");
      const at = iso(now);
      const countId = randomUUID();
      const closingLines: ClosingLine[] = [];
      for (const sku of expected) {
        const line = bySku.get(sku)!;
        if (!Number.isInteger(line.counted_qty) || line.counted_qty < 0) throw new PosError(400, "BAD_QTY", "Counted quantity must be a whole number.");
        const system = qtyOf(tx.state, sku);
        if (line.counted_qty !== system && !line.variance_reason?.trim()) throw new PosError(400, "REASON_REQUIRED", "A difference needs a reason.");
        closingLines.push({ sku, name: productName(tx.state, sku), left: line.counted_qty, system_qty: system });
      }
      tx.state.counts.push({ id: countId, shift_id: shift.id, kind: "CLOSING", confirmed_at: at, created_at: at });
      for (const line of closingLines) {
        tx.state.count_lines.push({
          id: randomUUID(),
          count_id: countId,
          sku: line.sku,
          system_qty: line.system_qty,
          counted_qty: line.left,
          variance_reason: bySku.get(line.sku)?.variance_reason?.trim() || null,
        });
      }
      expireTickets(tx.state, now.getTime(), shift.id);
      const closing = buildClosing(tx.state, shift, closingLines, false, at);
      finishShift(tx.state, shift, "POS_END", at, closing);
      const saved = tx.state.closings.find((row) => row.shift_id === shift.id) ?? closing;
      queueClosingSheets(tx.state, shift, saved, at);
      const result = { ok: true, message: END_SHIFT_MESSAGE, no_count: false, summary_text: saved.summary_text, closing: saved };
      remember(tx.state, "pos_end", input.key, body, result, now, this.deps.secrets.session);
      return result;
    });
  }

  async refreshIncoming(opts: { force?: boolean } = {}) {
    if (!opts.force) {
      const debounced = await this.db.transaction(async (tx) => {
        const cursor = tx.state.cursors.find((row) => row.tab === "K_Allocations");
        return Boolean(cursor?.last_polled_at && this.now().getTime() - Date.parse(cursor.last_polled_at) < IMPORT_DEBOUNCE_MS);
      });
      if (debounced) return { ok: true, debounced: true };
    }
    let rows: SheetRow[] = [];
    try {
      rows = await this.deps.sheet.readRows("K_Allocations");
    } catch (error) {
      if (error instanceof SheetUnavailable) return { ok: false, sheet_down: true };
      throw error;
    }
    return this.importRows(rows);
  }

  private async importRows(rows: SheetRow[]) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      const state = tx.state;
      let cursor = state.cursors.find((row) => row.tab === "K_Allocations");
      if (!cursor) {
        cursor = { tab: "K_Allocations", last_row_number: 0, last_polled_at: null, last_ok_at: null, last_full_scan_at: null };
        state.cursors.push(cursor);
      }
      const full = !cursor.last_full_scan_at || now.getTime() - Date.parse(cursor.last_full_scan_at) >= FULL_SCAN_MS;
      const minRow = full ? 0 : Math.max(0, cursor.last_row_number - IMPORT_OVERLAP_ROWS);
      let imported = 0;
      let maxRow = cursor.last_row_number;
      for (const row of rows) {
        const sheetRow = Number(row._sheet_row ?? 0);
        if (sheetRow < minRow) continue;
        maxRow = Math.max(maxRow, sheetRow);
        if ((row.store_code ?? "").trim() !== STORE_CODE) continue;
        const problem = this.kitchenProblem(state, row);
        if (problem) {
          const badId = row.row_id && isUuid(row.row_id) ? `R-${row.row_id}` : `R-BAD-${sheetRow}`;
          enqueue(state, "S_Receipts", badId, {
            row_id: badId,
            kitchen_row_id: row.row_id ?? "",
            store_code: STORE_CODE,
            sku: row.sku ?? "",
            qty_sent: row.qty ?? "",
            qty_received: "",
            variance: "",
            variance_reason: problem,
            status: "REJECTED",
            shift_id: "",
            staff_pos_id: "",
            confirmed_at: "",
          }, at);
          audit(state, "ROW_REJECTED", "sheet", row.row_id || String(sheetRow), "system", { reason: problem }, at);
          continue;
        }
        const existing = state.incoming.find((item) => item.kitchen_row_id === row.row_id);
        const qty = Number(row.qty);
        const kitchenStatus = (row.kitchen_status ?? "ACTIVE").toUpperCase();
        if (!existing) {
          const created = row.created_at || at;
          if (state.incoming.some((item) => item.batch_id === (row.batch_id ?? "") && item.sku === row.sku && item.qty_sent === qty && item.kitchen_created_at && Math.abs(Date.parse(item.kitchen_created_at) - Date.parse(created)) < 5 * 60 * 1000)) {
            audit(state, "DUPLICATE_BATCH_WINDOW", "incoming", row.row_id, "system", { batch_id: row.batch_id, sku: row.sku, qty }, at);
          }
          const incoming: IncomingRow = {
            kitchen_row_id: row.row_id,
            batch_id: row.batch_id ?? "",
            store_code: STORE_CODE,
            sku: row.sku,
            qty_sent: qty,
            kind: row.kind?.toUpperCase() === "REFILL" ? "REFILL" : "ALLOCATION",
            kitchen_created_at: row.created_at || null,
            imported_at: at,
            status: "PENDING_CONFIRM",
            qty_received: null,
            variance_reason: null,
            confirmed_shift_id: null,
            confirmed_at: null,
            linked_ledger_id: null,
            created_at: at,
          };
          state.incoming.push(incoming);
          imported += 1;
          enqueue(state, "S_Receipts", `R-${incoming.kitchen_row_id}`, receiptPayload(incoming, "", ""), at);
          if (kitchenStatus === "CANCELLED") this.applyCancel(state, incoming, at);
        } else if (qty !== existing.qty_sent) {
          audit(state, "QTY_CHANGED_AFTER_IMPORT", "incoming", existing.kitchen_row_id, "system", { sheet_qty: qty, imported_qty: existing.qty_sent }, at);
          if (kitchenStatus === "CANCELLED") this.applyCancel(state, existing, at);
        } else if (kitchenStatus === "CANCELLED") {
          this.applyCancel(state, existing, at);
        }
      }
      cursor.last_row_number = Math.max(cursor.last_row_number, maxRow);
      cursor.last_polled_at = at;
      cursor.last_ok_at = at;
      if (full) cursor.last_full_scan_at = at;
      return { ok: true, imported, full };
    });
  }

  private kitchenProblem(state: State, row: SheetRow) {
    if (!row.row_id || !isUuid(row.row_id)) return "row_id must be a UUID";
    if (!state.products.some((product) => product.sku === row.sku)) return "SKU does not exist";
    if (!/^[1-9]\d*$/.test(row.qty ?? "")) return "qty must be an integer greater than 0";
    const kind = (row.kind ?? "ALLOCATION").toUpperCase();
    if (kind !== "ALLOCATION" && kind !== "REFILL") return "kind must be ALLOCATION or REFILL";
    return null;
  }

  private applyCancel(state: State, row: IncomingRow, at: string) {
    if (row.status === "PENDING_CONFIRM") {
      row.status = "CANCELLED_BY_KITCHEN";
      row.confirmed_at = at;
      row.qty_received = 0;
      enqueue(state, "S_Receipts", `R-${row.kitchen_row_id}`, receiptPayload(row, "", ""), at);
      return;
    }
    if (row.status === "CONFIRMED" || row.status === "PARTIAL") {
      audit(state, "CANCEL_AFTER_CONFIRM", "incoming", row.kitchen_row_id, "system", { status: row.status }, at);
    }
  }

  async drainOutbox() {
    const now = this.now();
    const batch = await this.db.transaction(async (tx) => tx.state.outbox.filter((row) => row.status === "queued" && Date.parse(row.next_attempt_at) <= now.getTime()));
    if (batch.length === 0) return { ok: true, sent: 0 };
    const groups = new Map<string, typeof batch>();
    for (const row of batch) {
      const list = groups.get(row.tab) ?? [];
      list.push(row);
      groups.set(row.tab, list);
    }
    const tabs = [...OUTBOX_TAB_ORDER.filter((tab) => groups.has(tab)), ...[...groups.keys()].filter((tab) => !OUTBOX_TAB_ORDER.includes(tab as (typeof OUTBOX_TAB_ORDER)[number]))];
    try {
      for (const tab of tabs) {
        const rows = groups.get(tab) ?? [];
        if (rows.length) await this.deps.sheet.upsert(tab, rows.map((row) => row.payload));
      }
      await this.db.transaction(async (tx) => {
        const at = iso(this.now());
        for (const row of batch) {
          const current = tx.state.outbox.find((item) => item.id === row.id);
          if (!current || current.status !== "queued") continue;
          current.status = "sent";
          current.sent_at = at;
          current.last_error = null;
        }
      });
      return { ok: true, sent: batch.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sheet write failed";
      await this.db.transaction(async (tx) => {
        for (const row of batch) {
          const current = tx.state.outbox.find((item) => item.id === row.id);
          if (!current || current.status === "sent") continue;
          current.attempts += 1;
          current.last_error = message;
          const delay = BACKOFF_MIN[Math.min(current.attempts, BACKOFF_MIN.length) - 1] * 60 * 1000;
          current.next_attempt_at = iso(new Date(this.now().getTime() + delay));
          if (current.attempts >= OUTBOX_ERROR_ATTEMPTS) current.status = "error";
        }
      });
      if (error instanceof SheetUnavailable) return { ok: false, sheet_down: true };
      return { ok: false, error: message };
    }
  }

  async menu() {
    const nowMs = this.now().getTime();
    if (this.menuCache && this.menuCache.gen === this.menuGen && nowMs - this.menuCache.at < MENU_CACHE_MS) return this.menuCache.body;
    const body = await this.db.transaction(async (tx) => {
      const shift = tx.state.shifts.find((row) => row.store_code === STORE_CODE && row.status === "ACTIVE" && row.opening_confirmed_at && sellingBlocked(tx.state, row) == null);
      const items = tx.state.products
        .filter((product) => product.setb_active)
        .flatMap((product) => {
          const storeProduct = tx.state.store_products.find((item) => item.store_code === STORE_CODE && item.sku === product.sku);
          if (!storeProduct?.enabled || qtyOf(tx.state, product.sku) <= 0) return [];
          return [{
            sku: product.sku,
            name: product.name,
            category: product.category,
            price_cents: storeProduct.price_override_cents ?? product.default_price_cents,
            availability: "Available" as const,
          }];
        })
        .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
      return {
        ok: true,
        store: STORE_CODE,
        demo: Boolean(this.deps.demo),
        demo_label: this.deps.demo ? DEMO_LABEL : null,
        ordering: Boolean(shift),
        prices_include_tax: true,
        items,
      };
    });
    this.menuCache = { gen: this.menuGen, at: nowMs, body };
    return body;
  }

  async placeOrder(input: { key: string; lines: { sku: string; qty: number }[] }, ip: string) {
    this.hit(`order:${ip || "unknown"}`, 10, 60 * 1000);
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "menu_order", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const shift = tx.state.shifts.find((row) => row.store_code === STORE_CODE && row.status === "ACTIVE");
      if (!shift?.opening_confirmed_at || sellingBlocked(tx.state, shift)) throw new PosError(409, "ORDERING_CLOSED", "Ordering is unavailable right now.");
      const pending = tx.state.tickets.filter((ticket) => ticket.shift_id === shift.id && ticket.status === "PENDING").length;
      if (pending >= MAX_PENDING_TICKETS) throw new PosError(429, "TICKET_LIMIT", "The till queue is full. Please see staff.");
      const lines = mergeLines(input.lines);
      for (const line of lines) {
        try {
          priceOf(tx.state, line.sku);
        } catch {
          throw new PosError(400, "ITEM_UNAVAILABLE", "An item in that order is unavailable.");
        }
        if (qtyOf(tx.state, line.sku) <= 0) throw new PosError(400, "ITEM_UNAVAILABLE", "An item in that order is unavailable.");
      }
      const at = iso(now);
      shift.ticket_seq += 1;
      let code = `${shift.ticket_letter}${String(shift.ticket_seq).padStart(3, "0")}`;
      while (tx.state.tickets.some((ticket) => ticket.shift_id === shift.id && ticket.code === code)) {
        shift.ticket_seq += 1;
        code = `${shift.ticket_letter}${String(shift.ticket_seq).padStart(3, "0")}`;
      }
      const ticketId = randomUUID();
      tx.state.tickets.push({
        id: ticketId,
        shift_id: shift.id,
        code,
        status: "PENDING",
        source: "QR",
        expires_at: iso(new Date(now.getTime() + TICKET_TTL_MS)),
        created_at: at,
      });
      let total = 0;
      for (const line of lines) {
        const price = priceOf(tx.state, line.sku);
        total += price.cents * line.qty;
        tx.state.ticket_lines.push({ id: randomUUID(), ticket_id: ticketId, sku: line.sku, qty: line.qty, unit_price_cents_snapshot: price.cents });
      }
      const result = { ok: true, code, expires_at: iso(new Date(now.getTime() + TICKET_TTL_MS)), total_cents: total, prices_include_tax: true };
      remember(tx.state, "menu_order", input.key, body, result, now, this.deps.secrets.session);
      return result;
    });
  }

  async ticketStatus(code: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      expireTickets(tx.state, now.getTime());
      const ticket = tx.state.tickets
        .filter((row) => row.code.toUpperCase() === code.toUpperCase())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
      const lines = tx.state.ticket_lines.filter((line) => line.ticket_id === ticket.id);
      return {
        ok: true,
        code: ticket.code,
        status: ticket.status,
        expires_at: ticket.expires_at,
        prices_include_tax: true,
        total_cents: lines.reduce((sum, line) => sum + line.qty * line.unit_price_cents_snapshot, 0),
      };
    });
  }

  async expireDue() {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      const expired = expireTickets(tx.state, now.getTime());
      for (const shift of openShifts(tx.state)) {
        if (shift.pin_expires_at && Date.parse(shift.pin_expires_at) <= now.getTime()) {
          const closing = buildClosing(tx.state, shift, noCountLines(tx.state), true, at);
          finishShift(tx.state, shift, "EXPIRED", at, closing);
        }
      }
      return { ok: true, expired };
    });
  }

  async closedShifts() {
    return this.db.transaction(async (tx) => {
      const rows = tx.state.closings.filter((closing) => !closing.sccx_ack_at);
      for (const closing of rows) closing.sccx_attempts += 1;
      const closings = rows.map((closing) => {
        const shift = tx.state.shifts.find((row) => row.id === closing.shift_id);
        const staff = tx.state.staff.find((row) => row.staff_uid === shift?.staff_uid);
        return {
          shift_id: shift?.sccx_shift_id ?? closing.shift_id,
          staff_pos_id: staff?.pos_id ?? "",
          ended_at: shift?.ended_at,
          sales_total: closing.sales_total_cents,
          sale_count: closing.sale_count,
          voids: closing.void_count,
          cash_on_hand: closing.cash_on_hand_cents,
          deposited: closing.deposited_cents,
          tickets: { total: closing.tickets_total, cashed: closing.tickets_cashed_out, expired: closing.tickets_expired },
          left: closing.closing_lines.map((line) => ({ sku: line.sku, name: line.name, qty: line.left })),
          no_count: closing.no_count,
          money_unit: "cents",
          summary_text: closing.summary_text,
        };
      });
      return { ok: true, closings };
    });
  }

  async ackClosedShift(sccxShiftId: string, input: { key: string }) {
    const body = { ...input, shift_id: sccxShiftId } as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "closing_ack", input.key, body, now, this.deps.secrets.poll);
      if (seen) return seen;
      const shift = tx.state.shifts.find((row) => row.sccx_shift_id === sccxShiftId);
      const closing = tx.state.closings.find((row) => row.shift_id === shift?.id);
      if (!shift || !closing) throw new PosError(404, "CLOSING", "Closing was not found.");
      if (!closing.sccx_ack_at) closing.sccx_ack_at = iso(now);
      const result = { ok: true, shift_id: shift.sccx_shift_id, sccx_ack_at: closing.sccx_ack_at };
      remember(tx.state, "closing_ack", input.key, body, result, now, this.deps.secrets.poll);
      return result;
    });
  }

  async importRoster(input: { key: string; staff: { staff_uid: string; sccx_id?: string; pos_id?: string; display_name?: string; active?: boolean }[] }) {
    return this.upsertMany(input.key, "roster_import", input.staff, input as unknown as Json);
  }

  async upsertRoster(input: { key: string; event_id?: string; staff_uid: string; sccx_id?: string; pos_id?: string; display_name?: string; active?: boolean }) {
    return this.upsertMany(input.key || input.event_id || "", "roster_upsert", [input], input as unknown as Json);
  }

  private upsertMany(key: string, scope: string, people: { staff_uid: string; sccx_id?: string; pos_id?: string; display_name?: string; active?: boolean }[], body: Json) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, scope, key, body, now, this.deps.secrets.roster);
      if (seen) return seen;
      const at = iso(now);
      for (const person of people) {
        if (!person.staff_uid) throw new PosError(400, "STAFF", "staff_uid is required.");
        let staff = tx.state.staff.find((row) => row.staff_uid === person.staff_uid);
        if (!staff) {
          staff = {
            staff_uid: person.staff_uid,
            sccx_id: person.sccx_id ?? "",
            pos_id: person.pos_id ?? "",
            display_name: person.display_name ?? person.staff_uid,
            active: person.active !== false,
            updated_at: at,
            created_at: at,
          };
          tx.state.staff.push(staff);
        } else {
          if (person.sccx_id != null) staff.sccx_id = person.sccx_id;
          if (person.pos_id != null) staff.pos_id = person.pos_id;
          if (person.display_name != null) staff.display_name = person.display_name;
          if (person.active != null) staff.active = person.active;
          staff.updated_at = at;
        }
        if (!staff.active) {
          for (const shift of tx.state.shifts.filter((row) => row.staff_uid === staff!.staff_uid && row.status !== "ENDED")) {
            const closing = buildClosing(tx.state, shift, noCountLines(tx.state), true, at);
            finishShift(tx.state, shift, "UNLINKED", at, closing);
          }
        }
      }
      const result = { ok: true, count: people.length };
      remember(tx.state, scope, key, body, result, now, this.deps.secrets.roster);
      return result;
    });
  }

  async syncSetb(rows: Json[]) {
    const result = await this.db.transaction(async (tx) => {
      const at = iso(this.now());
      let updated = 0;
      for (const raw of rows) {
        const sku = String(raw.sku ?? "").trim();
        if (!sku) continue;
        const name = String(raw.name ?? sku);
        const category = String(raw.category ?? "Uncategorized");
        const active = raw.setb_active !== false && raw.active !== false;
        let price: number | null = null;
        if (typeof raw.default_price_cents === "number") price = Math.round(raw.default_price_cents);
        else if (typeof raw.price_cents === "number") price = Math.round(raw.price_cents);
        else if (typeof raw.price === "number") price = Math.round(raw.price * 100);
        let product = tx.state.products.find((item) => item.sku === sku);
        if (!product) {
          product = { sku, sku_sort: Number(sku) || 0, name, category, default_price_cents: price ?? 0, setb_active: active, synced_at: at, created_at: at };
          tx.state.products.push(product);
          tx.state.store_products.push({ store_code: STORE_CODE, sku, enabled: active, price_override_cents: null, created_at: at, updated_at: at });
        } else {
          product.name = name;
          product.category = category;
          product.setb_active = active;
          if (price != null) product.default_price_cents = price;
          product.synced_at = at;
          product.sku_sort = Number(sku) || product.sku_sort;
        }
        updated += 1;
      }
      return { ok: true, updated };
    });
    this.bumpMenu();
    return result;
  }

  async adminLogin(password: string) {
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const expected = this.deps.secrets.admin;
      if (!expected || !safeEqual(password, expected)) return { ok: false as const };
      const token = newToken();
      tx.state.admin_sessions.push({ id: randomUUID(), token_hash: sha256(token), expires_at: iso(new Date(now.getTime() + PIN_TTL_MS)), created_at: iso(now) });
      return { ok: true as const, token };
    });
    if (!result.ok) throw new PosError(401, "ADMIN_ONLY", "Admin sign-in is required.");
    return result;
  }

  async voidSale(adminToken: string, input: { key: string; sale_id: string; reason: string }) {
    const body = input as unknown as Json;
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "void", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      if (!input.reason?.trim()) throw new PosError(400, "REASON_REQUIRED", "A void needs a reason.");
      const sale = tx.state.sales.find((row) => row.id === input.sale_id);
      if (!sale) throw new PosError(404, "SALE", "Sale was not found.");
      if (sale.status !== "COMPLETED") throw new PosError(409, "VOID_FINAL", "That sale is already voided.");
      const at = iso(now);
      sale.status = "VOIDED";
      sale.void_reason = input.reason.trim();
      sale.voided_by = "admin";
      for (const line of tx.state.sale_lines.filter((row) => row.sale_id === sale.id)) {
        const next = balanceAdd(tx.state, line.sku, line.qty, at, true);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not restore stock.");
        ledger(tx.state, line.sku, line.qty, "VOID", "sale", sale.id, "admin", input.reason.trim(), sale.shift_id, at);
      }
      const payload = salePayload(tx.state, sale.id);
      if (payload) enqueue(tx.state, "S_Sales", payload.row_id, payload, at);
      const totals = shiftTotals(tx.state, sale.shift_id);
      const resultBody = { ok: true, status: "VOIDED", ...totals };
      remember(tx.state, "void", input.key, body, resultBody, now, this.deps.secrets.admin);
      return resultBody;
    });
    this.bumpMenu();
    return result;
  }

  async adjust(adminToken: string, input: { key: string; sku: string; qty_delta: number; reason: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "adjust", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      if (!input.reason?.trim()) throw new PosError(400, "REASON_REQUIRED", "An adjustment needs a reason.");
      if (!Number.isInteger(input.qty_delta) || input.qty_delta === 0) throw new PosError(400, "BAD_QTY", "Enter a non-zero whole quantity.");
      if (!tx.state.products.some((product) => product.sku === input.sku)) throw new PosError(404, "SKU", "SKU was not found.");
      const at = iso(now);
      const next = balanceAdd(tx.state, input.sku, input.qty_delta, at, true);
      if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Adjustment would take stock below zero.");
      const entry = ledger(tx.state, input.sku, input.qty_delta, "ADJUSTMENT", "admin", null, "admin", input.reason.trim(), null, at);
      const result = { ok: true, ledger_id: entry.id, qty: next };
      remember(tx.state, "adjust", input.key, body, result, now, this.deps.secrets.admin);
      return result;
    });
  }

  async openingBalance(adminToken: string, input: { key: string; sku: string; qty: number }) {
    const body = input as unknown as Json;
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "opening_balance", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      if (!Number.isInteger(input.qty) || input.qty < 0) throw new PosError(400, "BAD_QTY", "Opening quantity must be a whole number.");
      if (tx.state.ledger.some((row) => row.sku === input.sku && row.movement_type === "OPENING_BALANCE")) {
        throw new PosError(409, "OPENING_EXISTS", "Opening balance was already posted for that SKU.");
      }
      const at = iso(now);
      const next = balanceAdd(tx.state, input.sku, input.qty, at, true);
      if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not post opening balance.");
      ledger(tx.state, input.sku, input.qty, "OPENING_BALANCE", "admin", null, "admin", null, null, at);
      const resultBody = { ok: true, qty: next };
      remember(tx.state, "opening_balance", input.key, body, resultBody, now, this.deps.secrets.admin);
      return resultBody;
    });
    this.bumpMenu();
    return result;
  }

  async reissuePin(adminToken: string, input: { key: string; shift_id: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "reissue", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      const shift = tx.state.shifts.find((row) => row.id === input.shift_id || row.sccx_shift_id === input.shift_id);
      if (!shift || shift.status === "ENDED") throw new PosError(409, "SHIFT", "That shift cannot take a new PIN.");
      const at = iso(now);
      const pin = randomPin();
      shift.pin_hash = hashPin(pin);
      shift.pin_failed_attempts = 0;
      shift.status = "ACTIVE";
      shift.pin_expires_at = iso(new Date(now.getTime() + PIN_TTL_MS));
      revokeSessions(tx.state, shift.id, at);
      const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
      const result = { ok: true, pin, expires_at: shift.pin_expires_at, staff_name: staff?.display_name ?? "" };
      remember(tx.state, "reissue", input.key, body, result, now, this.deps.secrets.admin, true);
      return result;
    });
  }

  async killShift(adminToken: string, input: { key: string; shift_id: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "kill_shift", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      const shift = tx.state.shifts.find((row) => row.id === input.shift_id || row.sccx_shift_id === input.shift_id);
      if (!shift) throw new PosError(404, "SHIFT", "Shift was not found.");
      const at = iso(now);
      if (shift.status !== "ENDED") {
        const closing = buildClosing(tx.state, shift, noCountLines(tx.state), true, at);
        finishShift(tx.state, shift, "ADMIN", at, closing);
      }
      const result = { ok: true, status: shift.status };
      remember(tx.state, "kill_shift", input.key, body, result, now, this.deps.secrets.admin);
      return result;
    });
  }

  async setPrice(adminToken: string, input: { sku: string; price_override_cents?: number | null; enabled?: boolean }) {
    const result = await this.db.transaction(async (tx) => {
      requireAdmin(tx.state, adminToken, this.now());
      const product = tx.state.products.find((row) => row.sku === input.sku);
      if (!product) throw new PosError(404, "SKU", "SKU was not found.");
      let storeProduct = tx.state.store_products.find((row) => row.store_code === STORE_CODE && row.sku === input.sku);
      const at = iso(this.now());
      if (!storeProduct) {
        storeProduct = { store_code: STORE_CODE, sku: input.sku, enabled: true, price_override_cents: null, created_at: at, updated_at: at };
        tx.state.store_products.push(storeProduct);
      }
      if (input.price_override_cents === null) storeProduct.price_override_cents = null;
      else if (input.price_override_cents != null) {
        if (!Number.isInteger(input.price_override_cents) || input.price_override_cents < 0) throw new PosError(400, "BAD_PRICE", "Price must be whole cents.");
        storeProduct.price_override_cents = input.price_override_cents;
      }
      if (input.enabled != null) storeProduct.enabled = input.enabled;
      storeProduct.updated_at = at;
      return { ok: true };
    });
    this.bumpMenu();
    return result;
  }

  async linkAdjustment(adminToken: string, input: { key: string; kitchen_row_id: string; ledger_id: string; decision: "CONFIRM" | "REJECT" }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "link_adjustment", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      const row = tx.state.incoming.find((item) => item.kitchen_row_id === input.kitchen_row_id);
      if (!row || row.status !== "PENDING_CONFIRM") throw new PosError(409, "ALREADY_CONFIRMED", "That row is not waiting to be linked.");
      const entry = tx.state.ledger.find((item) => item.id === input.ledger_id && item.movement_type === "ADJUSTMENT");
      if (!entry) throw new PosError(404, "ADJUSTMENT", "Adjustment was not found.");
      const before = qtyOf(tx.state, row.sku);
      const at = iso(now);
      row.linked_ledger_id = entry.id;
      row.confirmed_at = at;
      if (input.decision === "REJECT") {
        row.status = "REJECTED";
        row.qty_received = 0;
        row.variance_reason = "REJECTED_AFTER_ADJUSTMENT";
      } else {
        row.status = "CONFIRMED";
        row.qty_received = Math.abs(entry.qty_delta);
        row.variance_reason = "LINKED_TO_ADJUSTMENT";
      }
      enqueue(tx.state, "S_Receipts", `R-${row.kitchen_row_id}`, receiptPayload(row, "", "admin"), at);
      const result = { ok: true, qty: qtyOf(tx.state, row.sku), unchanged: qtyOf(tx.state, row.sku) === before, status: row.status };
      remember(tx.state, "link_adjustment", input.key, body, result, now, this.deps.secrets.admin);
      return result;
    });
  }

  async adminState(adminToken: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const oldest = tx.state.outbox.filter((row) => row.status === "queued").map((row) => Date.parse(row.created_at)).sort((a, b) => a - b)[0];
      const closings = tx.state.closings.flatMap((closing) => {
        const shift = tx.state.shifts.find((row) => row.id === closing.shift_id);
        if (!shift?.ended_at) return [];
        const age = now.getTime() - Date.parse(shift.ended_at);
        return [{
          shift_id: shift.sccx_shift_id,
          ended_at: shift.ended_at,
          acked: Boolean(closing.sccx_ack_at),
          late: !closing.sccx_ack_at && age >= SCCX_ACK_LATE_MS,
          no_count: closing.no_count,
          summary_text: closing.summary_text,
        }];
      });
      return {
        ok: true,
        demo: Boolean(this.deps.demo),
        demo_label: this.deps.demo ? DEMO_LABEL : null,
        sheet_configured: this.deps.sheet.configured,
        sheet_sync_delayed: oldest != null && now.getTime() - oldest >= SHEET_DELAY_MS,
        sheet_alert: oldest != null && now.getTime() - oldest >= SHEET_ALERT_MS,
        sccx_not_acked: closings.some((row) => row.late),
        outbox: tx.state.outbox.map((row) => ({ id: row.id, tab: row.tab, row_id: row.row_id, status: row.status, attempts: row.attempts, last_error: row.last_error })),
        closings,
        shifts: tx.state.shifts.map((shift) => ({
          id: shift.id,
          sccx_shift_id: shift.sccx_shift_id,
          status: shift.status,
          staff_uid: shift.staff_uid,
          end_reason: shift.end_reason,
          pin_failed_attempts: shift.pin_failed_attempts,
        })),
        staff: tx.state.staff,
        products: tx.state.products.map((product) => {
          const storeProduct = tx.state.store_products.find((row) => row.store_code === STORE_CODE && row.sku === product.sku);
          return {
            sku: product.sku,
            name: product.name,
            category: product.category,
            setb_active: product.setb_active,
            enabled: storeProduct?.enabled ?? false,
            price_cents: storeProduct?.price_override_cents ?? product.default_price_cents,
            qty: qtyOf(tx.state, product.sku),
          };
        }),
        sales: tx.state.sales,
        alerts: tx.state.audit.filter((row) => ["QTY_CHANGED_AFTER_IMPORT", "CANCEL_AFTER_CONFIRM", "DUPLICATE_BATCH_WINDOW", "ROW_REJECTED"].includes(row.action)),
        reconciliation: reconcile(tx.state),
      };
    });
  }

  async reconciliation() {
    return this.db.transaction(async (tx) => reconcile(tx.state));
  }

  async snapshotStock() {
    await this.db.transaction(async (tx) => queueSnapshot(tx.state, iso(this.now())));
    return this.drainOutbox();
  }
}
