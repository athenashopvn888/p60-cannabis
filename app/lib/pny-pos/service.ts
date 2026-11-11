import { randomUUID } from "node:crypto";
import {
  DEMO_LABEL,
  DEMO_PIN,
  KITCHEN_PIN,
  MASTER_PIN,
  VERIFY_RELEASE,
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
  STORE_TZ,
  TICKET_LETTERS,
  TICKET_TTL_MS,
} from "./constants.ts";
import { decryptJson, encryptJson, hashPin, newToken, randomPin, readStaffSession, safeEqual, sha256, signStaffSession, stableStringify, verifyPin } from "./crypto.ts";
import type { DemoJournalOrder } from "./demoJournal.ts";
import { PosError, SheetUnavailable } from "./errors.ts";
import type { PosDb } from "./memory.ts";
import { closingSummaryView } from "./closingSummary.ts";
import { closingBalance, lineVariance } from "./closing.ts";
import { RAW_PRICE_TTL_MS, cartonNotesFromRawRows, unitPricesFromRawRows } from "./rawPrice.ts";
import { centsToSheet, depositAboveCash, formatMoney, formatStoreTime, inStockCategories, roundCents } from "./money.ts";
import { isCigaretteCategory } from "../siteConfig.ts";
import { parseFlowerSku, skuSortKey } from "./flowerSku.ts";
import { formatDepositCode, nextDepositSeq } from "./depositCode.ts";
import type { DemoDraft } from "./demoDraft.ts";
import { arrangeOff, compareCount, sizeLabel, staffSkuText, VERIFY_WINDOW_MS } from "./verifyCount.ts";
import { fetchPublishedFlowerGrid, flowerPriceCents, flowersFromGrid, overlayFlower, type FlowerIndex } from "./flowerRaw.ts";
import { itemsFromPriceSheetRows, lookupItem, syncItemsRawPrice, type ItemIndex, type ItemRecord } from "./itemRaw.ts";
import { catalogFromFeed, readCommittedPnyCatalog } from "./setbFeed.ts";
import { cigarettePackCents, quoteForSku } from "./sizePrice.ts";
import { summaryPlainText } from "./summary.ts";
import { currentStore } from "./storeContext.ts";
import { queueStockHistory, takeStockHistory } from "./stockHistory.ts";
import { adoptStockLabels, queueCloseSnapshot, stampCloseLabel, takeCloseSnapshots, takeNewStockLabels, type StockLabelRow } from "./stockLabel.ts";
import { PNY2_START_NOTE, pny2StartingLines } from "./pny2StartingStock.ts";
import { paperLines } from "./paperRefill.ts";
import { defaultThcCatalogFlag, isThcCatalogProduct, isThcSku } from "./thcSkuFlags.ts";
import type { SheetClient } from "./sheets.ts";
import { SheetDb } from "./sheetStore.ts";
import type {
  ClosingLine,
  ClosingRow,
  IncomingRow,
  MovementType,
  ProductRow,
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

function tillCode() {
  return currentStore().code;
}

const TONIGHT_DISPLAY_NAME = "Anom";
const TONIGHT_NAME_MARK = "PNY01-TONIGHT";

/** Rename the staff member on the open PNY01 shift once. Does not touch the PIN. */
function nameLiveShift(state: State, at: string) {
  if (process.env.STORE_CODE?.trim()) return;
  if (tillCode() !== "PNY01") return;
  if (state.audit.some((row) => row.action === "DISPLAY_NAME" && row.ref_id === TONIGHT_NAME_MARK)) return;
  const shift = state.shifts.find((row) => row.store_code === tillCode() && (row.status === "ACTIVE" || row.status === "CLOSING"));
  if (!shift) return;
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  if (!staff) return;
  const previous = staff.display_name;
  if (previous !== TONIGHT_DISPLAY_NAME) {
    staff.display_name = TONIGHT_DISPLAY_NAME;
    staff.updated_at = at;
  }
  const queued = state.outbox.find((row) => row.row_id === `SH-${shift.id}`);
  if (queued) {
    queued.payload = { ...queued.payload, staff_name: TONIGHT_DISPLAY_NAME };
    queued.status = "queued";
    queued.sent_at = null;
    queued.next_attempt_at = at;
  }
  audit(state, "DISPLAY_NAME", "staff", TONIGHT_NAME_MARK, staff.staff_uid, { from: previous, to: TONIGHT_DISPLAY_NAME }, at);
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
    ...(tillCode() === "PNY01" ? {} : { store_code: tillCode() }),
  };
  state.ledger.push(row);
  if (delta !== 0) queueStockHistory(state, row.id);
  return row;
}

function balanceForStore(row: { store_code?: string }, code = tillCode()) {
  if (code === "PNY01") return !row.store_code || row.store_code === "PNY01";
  return row.store_code === code;
}

function nextOrderRef(state: State) {
  const prefix = currentStore().orderPrefix;
  const count = prefix === "PNY01"
    ? state.sales.filter((sale) => !sale.ref_no.startsWith("PNY02-")).length
    : state.sales.filter((sale) => sale.ref_no.startsWith(`${prefix}-`)).length;
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

function journalFromTicket(state: State, ticketId: string): DemoJournalOrder | null {
  const ticket = state.tickets.find((row) => row.id === ticketId);
  if (!ticket) return null;
  if (ticket.status !== "PENDING" && ticket.status !== "OPEN" && ticket.status !== "CASHED_OUT" && ticket.status !== "CANCELLED") return null;
  const lines = state.ticket_lines
    .filter((line) => line.ticket_id === ticket.id)
    .map((line) => ({ sku: line.sku, qty: line.qty, unit_price_cents: line.unit_price_cents_snapshot }));
  const sale = state.sales.find((row) => row.ticket_id === ticket.id && row.status === "COMPLETED");
  return {
    id: ticket.id,
    code: ticket.code,
    shift_id: ticket.shift_id,
    status: ticket.status,
    expires_at: ticket.expires_at,
    created_at: ticket.created_at,
    lines,
    sale: sale
      ? {
          id: sale.id,
          ref_no: sale.ref_no,
          total_cents: sale.total_cents,
          staff_uid: sale.staff_uid,
          created_at: sale.created_at,
          payment_method: sale.payment_method,
          lines: state.sale_lines
            .filter((line) => line.sale_id === sale.id)
            .map((line) => ({ sku: line.sku, qty: line.qty, unit_price_cents: line.unit_price_cents })),
        }
      : null,
  };
}

function paidSaleBody(state: State, ticketId: string) {
  const sale = state.sales.find((row) => row.ticket_id === ticketId && row.status === "COMPLETED");
  if (!sale) return null;
  return {
    ok: true,
    replay: true,
    sale_id: sale.id,
    ref_no: sale.ref_no,
    total_cents: sale.total_cents,
    prices_tax_included: true,
    payment_method: sale.payment_method,
    lines: state.sale_lines
      .filter((line) => line.sale_id === sale.id)
      .map((line) => ({ sku: line.sku, qty: line.qty, unit_price_cents: line.unit_price_cents, line_total_cents: line.line_total_cents })),
    journal_order: journalFromTicket(state, ticketId),
  };
}

/** Replay demo orders from the browser cookie onto a fresh seed without counting a sale twice. */
function absorbDemoJournal(state: State, orders: DemoJournalOrder[] | undefined) {
  if (!orders?.length) return;
  for (const order of orders) {
    let ticket = state.tickets.find((row) => row.id === order.id);
    if (!ticket) {
      ticket = {
        id: order.id,
        shift_id: order.shift_id,
        code: order.code,
        status: order.status,
        source: "QR",
        expires_at: order.expires_at,
        created_at: order.created_at,
      };
      state.tickets.push(ticket);
      for (const line of order.lines) {
        state.ticket_lines.push({
          id: randomUUID(),
          ticket_id: order.id,
          sku: line.sku,
          qty: line.qty,
          unit_price_cents_snapshot: line.unit_price_cents,
        });
      }
    } else if (ticket.status !== "CASHED_OUT") {
      if (order.status === "CASHED_OUT" || order.status === "CANCELLED" || (order.status === "OPEN" && ticket.status === "PENDING")) {
        ticket.status = order.status;
      }
    }
    if (order.status === "CASHED_OUT") ticket.status = "CASHED_OUT";
    if (!order.sale) continue;
    if (state.sales.some((sale) => sale.id === order.sale!.id || (sale.ticket_id === order.id && sale.status === "COMPLETED"))) {
      ticket.status = "CASHED_OUT";
      continue;
    }
    const at = order.sale.created_at;
    const enough = order.sale.lines.every((line) => (state.balances.find((row) => row.sku === line.sku)?.qty ?? 0) >= line.qty);
    if (enough) {
      for (const line of order.sale.lines) {
        balanceAdd(state, line.sku, -line.qty, at, false);
        ledger(state, line.sku, -line.qty, "SALE", "sale", order.sale.id, order.sale.staff_uid, null, order.shift_id, at);
      }
    }
    state.sales.push({
      id: order.sale.id,
      ref_no: order.sale.ref_no,
      shift_id: order.shift_id,
      staff_uid: order.sale.staff_uid,
      ticket_id: order.id,
      total_cents: order.sale.total_cents,
      prices_tax_included: true,
      payment_method: order.sale.payment_method === "DEBIT" ? "DEBIT" : "CASH",
      status: "COMPLETED",
      void_reason: null,
      voided_by: null,
      created_at: at,
    });
    for (const line of order.sale.lines) {
      state.sale_lines.push({
        id: randomUUID(),
        sale_id: order.sale.id,
        sku: line.sku,
        qty: line.qty,
        unit_price_cents: line.unit_price_cents,
        price_source: "SETB_DEFAULT",
        line_total_cents: line.unit_price_cents * line.qty,
      });
    }
    ticket.status = "CASHED_OUT";
  }
}

function balanceAdd(state: State, sku: string, delta: number, at: string, create: boolean) {
  const code = tillCode();
  let row = state.balances.find((item) => item.sku === sku && balanceForStore(item, code));
  if (!row) {
    if (!create || delta < 0) return null;
    row = { sku, qty: 0, updated_at: at, created_at: at, ...(code === "PNY01" ? {} : { store_code: code }) };
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
  const cashSales = sales.filter((sale) => sale.payment_method !== "DEBIT").reduce((sum, sale) => sum + sale.total_cents, 0);
  const debitSales = sales.filter((sale) => sale.payment_method === "DEBIT").reduce((sum, sale) => sum + sale.total_cents, 0);
  const deposited = deposits.reduce((sum, deposit) => sum + deposit.amount_cents, 0);
  return {
    sales_total_cents: cashSales + debitSales,
    cash_sales_cents: cashSales,
    debit_sales_cents: debitSales,
    sale_count: sales.length,
    void_count: voids.length,
    deposited_cents: deposited,
    cash_on_hand_cents: cashSales - deposited,
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

function pricedItem(_sku: string, record: ItemRecord) {
  if (/\b(marlboro|belmont)\b/i.test(record.name)) return 1000;
  return record.price_cents;
}

function presentCatalogItem<T extends { sku: string; name: string; category: string; price_cents: number; image_url?: string | null }>(item: T, flowers: FlowerIndex | null, items: ItemIndex | null): T {
  if (parseFlowerSku(item.sku)) {
    const shown = overlayFlower(item, flowers);
    const pack = cigarettePackCents(shown.sku, shown.category, shown.name);
    return pack != null ? { ...shown, price_cents: pack } : shown;
  }
  const record = lookupItem(items, item.sku);
  if (!record) return item;
  return {
    ...item,
    name: record.name || item.name,
    category: record.category || item.category,
    image_url: record.image ?? item.image_url ?? null,
    price_cents: pricedItem(item.sku, record),
  };
}

let catalogImages: Map<string, string> | null = null;

function hostedImage(sku: string) {
  if (!catalogImages) {
    catalogImages = new Map();
    for (const row of catalogFromFeed(readCommittedPnyCatalog())) {
      if (row.image_url) catalogImages.set(row.sku, row.image_url);
    }
  }
  return catalogImages.get(sku) ?? null;
}

type MasterProduct = { product: ProductRow; enabled: boolean; override: number | null };

function stockedCatalogRows(state: State, items: ItemIndex | null) {
  if (!items || items.size === 0) return [];
  const rows: { sku: string; sku_sort: number; name: string; category: string; price_cents: number; image_url: string | null; qty: number }[] = [];
  for (const balance of state.balances) {
    if (balance.qty <= 0 || !balanceForStore(balance) || parseFlowerSku(balance.sku)) continue;
    const record = lookupItem(items, balance.sku);
    if (!record) continue;
    const cents = pricedItem(balance.sku, record);
    if (cents <= 0) continue;
    rows.push({ sku: balance.sku, sku_sort: skuSortKey(balance.sku), name: record.name, category: record.category, price_cents: cents, image_url: record.image || hostedImage(balance.sku), qty: balance.qty });
  }
  return rows;
}

/** On-hand rows that are not already in this till's product list. Prices and photos come from the sheet catalog the old till uses. */
function stockedMasterRows(state: State, masters: Map<string, MasterProduct>, flowers: FlowerIndex | null, items: ItemIndex | null) {
  const rows: { sku: string; sku_sort: number; name: string; category: string; price_cents: number; image_url: string | null; qty: number; flower_type: string; thc: string; price_source: "RAW_UNIT" }[] = [];
  for (const balance of state.balances) {
    if (balance.qty <= 0 || !balanceForStore(balance)) continue;
    if (state.products.some((product) => product.sku === balance.sku)) continue;
    const hit = masters.get(balance.sku);
    if (!hit?.product.setb_active || !hit.enabled) continue;
    const shown = presentCatalogItem({
      sku: hit.product.sku,
      sku_sort: hit.product.sku_sort,
      name: hit.product.name,
      category: hit.product.category,
      price_cents: hit.override ?? hit.product.default_price_cents,
      image_url: hit.product.image_url || hostedImage(balance.sku),
      qty: balance.qty,
      flower_type: "",
      thc: "",
    }, flowers, items);
    if (shown.price_cents <= 0) continue;
    rows.push({ ...shown, qty: balance.qty, price_source: "RAW_UNIT" });
  }
  return rows;
}

function priceOf(state: State, sku: string, raw?: Map<string, number>, flowers?: FlowerIndex | null, items?: ItemIndex | null, masters?: Map<string, MasterProduct>) {
  const product = state.products.find((item) => item.sku === sku);
  const storeProduct = state.store_products.find((item) => item.store_code === tillCode() && item.sku === sku);
  const record = lookupItem(items, sku);
  const master = !product ? masters?.get(sku) : undefined;
  if (master?.product.setb_active && master.enabled) {
    const fromFlower = flowerPriceCents(flowers, sku);
    const pack = cigarettePackCents(sku, master.product.category, master.product.name);
    const cents = fromFlower ?? pack ?? raw?.get(sku) ?? master.override ?? master.product.default_price_cents;
    if (cents > 0) return { cents, source: fromFlower != null || pack != null || raw?.get(sku) != null ? "RAW_UNIT" as const : "SETB_DEFAULT" as const, product: master.product };
  }
  if (!product?.setb_active || !storeProduct?.enabled) {
    if (!record) throw new PosError(409, "NOT_SELLABLE", "That item is not for sale.");
    const cents = pricedItem(sku, record);
    if (cents <= 0) throw new PosError(409, "NOT_SELLABLE", "That item is not for sale.");
    return {
      cents,
      source: "RAW_UNIT" as const,
      product: {
        sku,
        sku_sort: skuSortKey(sku),
        name: record.name,
        category: record.category,
        default_price_cents: cents,
        image_url: record.image,
        setb_active: true,
        synced_at: null,
        created_at: "",
      },
    };
  }
  if (record) {
    const cents = pricedItem(sku, record);
    if (cents > 0) return { cents, source: "RAW_UNIT" as const, product };
  }
  const packCents = cigarettePackCents(sku, product.category, product.name);
  if (packCents != null) return { cents: packCents, source: "RAW_UNIT" as const, product };
  const fromFlower = flowerPriceCents(flowers, sku);
  if (fromFlower != null) return { cents: fromFlower, source: "RAW_UNIT" as const, product };
  const fromSheet = raw?.get(sku);
  if (fromSheet != null) return { cents: fromSheet, source: "RAW_UNIT" as const, product };
  if (storeProduct.price_override_cents != null) return { cents: storeProduct.price_override_cents, source: "STORE_OVERRIDE" as const, product };
  return { cents: product.default_price_cents, source: "SETB_DEFAULT" as const, product };
}

function qtyOf(state: State, sku: string) {
  return state.balances.find((row) => row.sku === sku && balanceForStore(row))?.qty ?? 0;
}

function sellingPriceCents(state: State, sku: string, raw?: Map<string, number>, flowers?: FlowerIndex | null, items?: ItemIndex | null) {
  const product = state.products.find((item) => item.sku === sku);
  const record = lookupItem(items, sku);
  if (record && record.price_cents > 0) return pricedItem(sku, record);
  const packCents = cigarettePackCents(sku, product?.category ?? record?.category, product?.name ?? record?.name);
  if (packCents != null) return packCents;
  const fromFlower = flowerPriceCents(flowers, sku);
  if (fromFlower != null) return fromFlower;
  const fromSheet = raw?.get(sku);
  if (fromSheet != null) return fromSheet;
  const storeProduct = state.store_products.find((item) => item.store_code === tillCode() && item.sku === sku);
  return storeProduct?.price_override_cents ?? product?.default_price_cents ?? 0;
}

function paymentOf(value: unknown) {
  if (value == null || value === "") return "CASH" as const;
  const method = String(value).trim().toUpperCase();
  if (method !== "CASH" && method !== "DEBIT") throw new PosError(400, "BAD_PAYMENT", "Pick Cash or Debit.");
  return method as "CASH" | "DEBIT";
}

function draftsOf(state: State) {
  if (!state.closing_drafts) state.closing_drafts = [];
  return state.closing_drafts;
}

/** Opening count: on-hand stock, plus a kitchen row that is still waiting to be received. */
function weedAnswerRequired(shift: ShiftRow) {
  return shift.store_code === "PNY01" && shift.weed_gate_required === true && shift.weed_in_store == null;
}

function noWeedShift(shift: ShiftRow | undefined) {
  return shift?.store_code === "PNY01" && shift.weed_gate_required === true && shift.weed_in_store === false;
}

function thcForState(state: State, sku: string) {
  const product = state.products.find((row) => row.sku === sku);
  return product ? isThcCatalogProduct(product) : isThcSku(sku);
}

function visibleForShift(state: State, shift: ShiftRow | undefined, sku: string) {
  return !noWeedShift(shift) || !thcForState(state, sku);
}

function requireWeedAnswer(shift: ShiftRow) {
  if (weedAnswerRequired(shift)) throw new PosError(409, "WEED_ANSWER_REQUIRED", "Answer WEED in store this shift? YES / NO first.");
}

function openingPlan(state: State, raw?: Map<string, number>, shift?: ShiftRow) {
  const incoming = state.incoming.filter((row) => row.status === "PENDING_CONFIRM" && row.qty_sent > 0 && (!row.store_code || row.store_code === tillCode()));
  const skus = new Set<string>();
  for (const balance of state.balances) if (balance.qty > 0 && balanceForStore(balance)) skus.add(balance.sku);
  for (const row of incoming) if (!row.store_code || row.store_code === tillCode()) skus.add(row.sku);
  return [...skus]
    .filter((sku) => visibleForShift(state, shift, sku))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((sku) => ({
      sku,
      name: productName(state, sku),
      price_cents: sellingPriceCents(state, sku, raw),
      system_qty: qtyOf(state, sku),
      incoming_qty: incoming.filter((row) => row.sku === sku).reduce((sum, row) => sum + row.qty_sent, 0),
    }));
}

/** SKUs that had stock this shift: opening on-hand plus confirmed refills and allocations. */
function shiftClosePlan(state: State, shiftId: string, raw?: Map<string, number>) {
  const shift = state.shifts.find((row) => row.id === shiftId);
  const opening = state.counts.find((row) => row.shift_id === shiftId && row.kind === "OPENING");
  const openingLines = opening ? state.count_lines.filter((row) => row.count_id === opening.id) : [];
  const saleIds = new Set(state.sales.filter((sale) => sale.shift_id === shiftId && sale.status === "COMPLETED").map((sale) => sale.id));
  const soldQty = (sku: string) => state.sale_lines.filter((line) => line.sku === sku && saleIds.has(line.sale_id)).reduce((sum, line) => sum + line.qty, 0);
  const receivedQty = (sku: string) => state.incoming
    .filter((row) => row.confirmed_shift_id === shiftId && row.sku === sku && (row.status === "CONFIRMED" || row.status === "PARTIAL"))
    .reduce((sum, row) => sum + (row.qty_received ?? 0), 0);
  const adjustQty = (sku: string) => state.ledger
    .filter((row) => row.shift_id === shiftId && row.sku === sku && (row.movement_type === "ADJUSTMENT" || row.movement_type === "COUNT_VARIANCE"))
    .reduce((sum, row) => sum + row.qty_delta, 0);
  const skus = new Set<string>([
    ...state.balances.filter((row) => balanceForStore(row)).map((row) => row.sku),
    ...openingLines.map((row) => row.sku),
    ...state.incoming.filter((row) => row.confirmed_shift_id === shiftId).map((row) => row.sku),
  ]);
  return [...skus]
    .filter((sku) => visibleForShift(state, shift, sku))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((sku) => {
      const received = receivedQty(sku);
      const sold = soldQty(sku);
      const openingQty = opening
        ? (openingLines.find((line) => line.sku === sku)?.counted_qty ?? 0)
        : qtyOf(state, sku) - received + sold - adjustQty(sku);
      return {
        sku,
        name: productName(state, sku),
        price_cents: sellingPriceCents(state, sku, raw),
        opening_qty: openingQty,
        received_qty: received,
        sold_qty: sold,
        expected_qty: openingQty + received - sold,
      };
    })
    .filter((line) => line.opening_qty + line.received_qty > 0);
}

function issueDepositCode(state: State) {
  if (tillCode() === "PNY02") return issuePny2DepositCode(state);
  const existing = [
    ...state.deposits.map((row) => row.deposit_code),
    ...(state.closing_drafts ?? []).map((row) => row.final_deposit_code),
  ];
  try {
    const seq = nextDepositSeq(state.deposit_seq, existing);
    state.deposit_seq = seq;
    return formatDepositCode(seq);
  } catch {
    throw new PosError(503, "DEPOSIT_CODE", "Could not assign a deposit number. Try again.");
  }
}

function issuePny2DepositCode(state: State) {
  const pattern = /^PNY2-D(\d{4})$/;
  let max = Number.isInteger(state.deposit_seq_pny02) && (state.deposit_seq_pny02 as number) > 0 ? (state.deposit_seq_pny02 as number) : 0;
  for (const code of [...state.deposits.map((row) => row.deposit_code), ...(state.closing_drafts ?? []).map((row) => row.final_deposit_code)]) {
    const match = pattern.exec(code ?? "");
    if (match) max = Math.max(max, Number(match[1]));
  }
  const seq = max + 1;
  if (seq > 9999) throw new PosError(503, "DEPOSIT_CODE", "Could not assign a deposit number. Try again.");
  state.deposit_seq_pny02 = seq;
  return `PNY2-D${String(seq).padStart(4, "0")}`;
}

function releaseTailDepositCode(state: State, code: string | null | undefined) {
  if (!code) return false;
  if (code.startsWith("PNY2-D")) {
    const match = /^PNY2-D(\d{4})$/.exec(code);
    if (!match) return false;
    const seq = Number(match[1]);
    if (state.deposit_seq_pny02 !== seq) return false;
    if (state.deposits.some((row) => row.deposit_code === code)) return false;
    if ((state.closing_drafts ?? []).some((row) => row.final_deposit_code === code)) return false;
    state.deposit_seq_pny02 = seq - 1;
    return true;
  }
  const match = /^(?:PNY-)?D(\d{4})$/.exec(code);
  if (!match) return false;
  const seq = Number(match[1]);
  if (state.deposit_seq !== seq) return false;
  if (state.deposits.some((row) => row.deposit_code === code)) return false;
  if ((state.closing_drafts ?? []).some((row) => row.final_deposit_code === code)) return false;
  state.deposit_seq = seq - 1;
  return true;
}

function countMeta(state: State, sku: string) {
  const product = state.products.find((row) => row.sku === sku);
  return { sku, name: product?.name ?? productName(state, sku), category: product?.category ?? "", bag: sizeLabel(sku, product?.category, product?.name) };
}

function sortCountSkus(state: State, skus: Iterable<string>) {
  return [...skus].sort((a, b) => compareCount(countMeta(state, a), countMeta(state, b)));
}

function salesAfter(state: State, shiftId: string, sku: string, afterMs: number) {
  const sales = state.sales.filter((sale) => sale.shift_id === shiftId && sale.status === "COMPLETED" && Date.parse(sale.created_at) > afterMs);
  const ids = new Set(sales.map((sale) => sale.id));
  return state.sale_lines.filter((line) => line.sku === sku && ids.has(line.sale_id)).reduce((sum, line) => sum + line.qty, 0);
}

function salesUntil(state: State, shiftId: string, sku: string, untilMs: number) {
  const sales = state.sales.filter((sale) => sale.shift_id === shiftId && sale.status === "COMPLETED" && Date.parse(sale.created_at) <= untilMs);
  const ids = new Set(sales.map((sale) => sale.id));
  return state.sale_lines.filter((line) => line.sku === sku && ids.has(line.sale_id)).reduce((sum, line) => sum + line.qty, 0);
}

function refillsUntil(state: State, shiftId: string, sku: string, untilMs: number) {
  return state.incoming
    .filter((row) => row.confirmed_shift_id === shiftId && row.sku === sku && (row.status === "CONFIRMED" || row.status === "PARTIAL"))
    .filter((row) => {
      const at = Date.parse(row.confirmed_at ?? row.created_at);
      return Number.isFinite(at) && at <= untilMs;
    })
    .reduce((sum, row) => sum + (row.qty_received ?? 0), 0);
}

function previousCloseLeft(state: State, shift: ShiftRow, sku: string) {
  const rows = state.closings
    .filter((row) => row.shift_id !== shift.id)
    .map((row) => ({ row, when: Date.parse(row.created_at) }))
    .sort((a, b) => b.when - a.when);
  for (const item of rows) {
    const owner = state.shifts.find((candidate) => candidate.id === item.row.shift_id);
    if (owner && owner.store_code !== shift.store_code) continue;
    return item.row.closing_lines.find((line) => line.sku === sku)?.left ?? null;
  }
  return null;
}

/** Expected at the moment a verify count is submitted. Later sales do not change a stored result. */
function expectedAtSubmit(state: State, shift: ShiftRow, sku: string, untilMs: number) {
  const refills = refillsUntil(state, shift.id, sku, untilMs);
  const sales = salesUntil(state, shift.id, sku, untilMs);
  const previous = previousCloseLeft(state, shift, sku);
  if (previous != null) return previous + refills - sales;
  const started = qtyOf(state, sku) - refills + sales;
  return started + refills - sales;
}

function verifySkuList(state: State, shiftId: string) {
  const shift = state.shifts.find((row) => row.id === shiftId);
  const skus = new Set(openingPlan(state, undefined, shift).map((line) => line.sku));
  const draft = draftsOf(state).find((row) => row.shift_id === shiftId);
  for (const row of draft?.opening_counts ?? []) if (visibleForShift(state, shift, row.sku)) skus.add(row.sku);
  return sortCountSkus(state, skus);
}

function ensureDraft(state: State, shiftId: string, now: Date) {
  const drafts = draftsOf(state);
  let draft = drafts.find((row) => row.shift_id === shiftId);
  if (!draft) {
    draft = { shift_id: shiftId, counts: [], opening_counts: [], final_deposit_cents: null, updated_at: iso(now) };
    drafts.push(draft);
  }
  if (!draft.opening_counts) draft.opening_counts = [];
  return draft;
}

function verifyAnchorMs(shift: ShiftRow) {
  if (shift.verify_release !== VERIFY_RELEASE || !shift.verify_opened_at) return null;
  const at = Date.parse(shift.verify_opened_at);
  return Number.isFinite(at) ? at : null;
}

/** First staff PIN login of this release starts the two-hour window. Later staff logins leave it. */
function startStaffVerify(shift: ShiftRow, at: string) {
  if (shift.verify_release === VERIFY_RELEASE && shift.verify_opened_at) return;
  shift.verify_opened_at = at;
  shift.verify_release = VERIFY_RELEASE;
}

function denyMaster(session: { master?: boolean }) {
  if (session.master) throw new PosError(403, "MASTER_VIEW", "Master login is view-only. Use the staff PIN to record the shift.");
}

function countMoment(row: { edited_at?: string; submitted_at?: string } | undefined, fallback: number) {
  const at = Date.parse(row?.edited_at || row?.submitted_at || "");
  return Number.isFinite(at) ? at : fallback;
}

/** Close the verify count. Entered drafts keep the expected from their last edit. Blanks are accepted as-is. */
function finalizeVerify(state: State, shift: ShiftRow, actor: string, now: Date) {
  const draft = ensureDraft(state, shift.id, now);
  if (draft.verify_submitted_at) return;
  const at = iso(now);
  const moment = now.getTime();
  for (const sku of verifySkuList(state, shift.id)) {
    const row = draft.opening_counts?.find((entry) => entry.sku === sku);
    if (row?.accepted_as_is && row.expected_qty != null) continue;
    const entered = row && !row.accepted_as_is && (row.edited_at || row.submitted_at);
    const expected = expectedAtSubmit(state, shift, sku, entered ? countMoment(row, moment) : moment);
    if (entered && row) {
      row.expected_qty = expected;
      row.edited_at = row.edited_at || row.submitted_at;
      row.accepted_as_is = false;
      row.added_stock = qtyOf(state, sku) === 0 && row.counted_qty > 0;
    } else if (row) {
      row.counted_qty = expected;
      row.expected_qty = expected;
      row.accepted_as_is = true;
      row.submitted_at = at;
      row.added_stock = false;
    } else {
      draft.opening_counts?.push({ sku, counted_qty: expected, expected_qty: expected, submitted_at: at, variance_reason: null, added_stock: false, accepted_as_is: true });
    }
    audit(state, entered ? "VERIFY_COUNT" : "VERIFY_ACCEPTED", "sku", sku, actor, { sku, accepted_as_is: !entered }, at);
  }
  draft.verify_submitted_at = at;
  draft.updated_at = at;
}

function lockUnverified(state: State, shift: ShiftRow, actor: string, now: Date) {
  const anchor = verifyAnchorMs(shift);
  if (anchor == null || now.getTime() < anchor + VERIFY_WINDOW_MS) return;
  finalizeVerify(state, shift, actor, now);
}

function staffOffLine(state: State, sku: string, off: number) {
  const product = state.products.find((row) => row.sku === sku);
  const size = sizeLabel(sku, product?.category, product?.name);
  return { sku, text: staffSkuText(sku, size), off };
}

function shelfCents(state: State, sku: string, raw?: Map<string, number>) {
  const priced = sellingPriceCents(state, sku, raw);
  if (priced > 0) return priced;
  return quoteForSku(sku)?.cents ?? 0;
}

function pricedOff(state: State, sku: string, off: number, raw?: Map<string, number>) {
  const price = shelfCents(state, sku, raw);
  return { ...staffOffLine(state, sku, off), cents: off * price };
}

function collectVerify(state: State, shift: ShiftRow, actor: string, now: Date, raw: Map<string, number> | undefined, demo: boolean, lock = true) {
  if (lock) lockUnverified(state, shift, actor, now);
  const skus = verifySkuList(state, shift.id);
  const draft = draftsOf(state).find((row) => row.shift_id === shift.id);
  const anchor = verifyAnchorMs(shift);
  const deadline = anchor == null ? null : new Date(anchor + VERIFY_WINDOW_MS).toISOString();
  const windowOpen = deadline != null && now.getTime() < Date.parse(deadline);
  const waiting = anchor == null && !lock && skus.length > 0;
  const submitted = Boolean(draft?.verify_submitted_at);
  const cleared = skus.filter((sku) => draft?.opening_counts?.some((row) => row.sku === sku && !row.accepted_as_is)).length;
  const showBanner = windowOpen && !submitted && skus.length > 0;
  const reveal = submitted;
  const opening = skus.flatMap((sku) => {
    const row = draft?.opening_counts?.find((entry) => entry.sku === sku);
    if (!row || row.accepted_as_is || row.expected_qty == null) return [];
    return [pricedOff(state, sku, row.counted_qty - row.expected_qty, raw)];
  });
  const openingLines = arrangeOff(opening, skus).filter((line) => line.off !== 0);
  const closePlan = [...shiftClosePlan(state, shift.id, raw)].sort((a, b) => compareCount(countMeta(state, a.sku), countMeta(state, b.sku)));
  const closing = closePlan.flatMap((line) => {
    const counted = draft?.counts.find((row) => row.sku === line.sku)?.counted_qty;
    if (counted == null) return [];
    return [pricedOff(state, line.sku, counted - line.expected_qty, raw)];
  });
  const closingUsesEdit = Boolean(draft?.counts.some((row) => row.edited_at || row.accepted_as_is));
  const closingSubmitted = Boolean(draft?.closing_submitted_at);
  const closingCompared = closePlan.flatMap((line) => {
    const row = draft?.counts.find((entry) => entry.sku === line.sku);
    if (!row || row.accepted_as_is) return [];
    const expected = row.edited_at ? (row.expected_qty ?? line.expected_qty) : line.expected_qty;
    return [pricedOff(state, line.sku, row.counted_qty - expected, raw)];
  });
  const closingSource = closingUsesEdit ? closingCompared : closing;
  const closingAll = arrangeOff(closingSource, closePlan.map((line) => line.sku));
  const closingReady = closingSubmitted || (!closingUsesEdit && closePlan.length > 0 && closing.length === closePlan.length);
  const closingLines = closingReady ? closingAll.filter((line) => line.off !== 0) : [];
  const offCount = (lines: { off: number }[]) => lines.filter((line) => line.off !== 0).length;
  const refills = refillIssues(state, shift.id, raw);
  return {
    verify: {
      show_banner: showBanner,
      deadline_at: deadline,
      waiting,
      cleared,
      total: skus.length,
      reveal,
      submitted,
      lines: skus.map((sku) => {
        const product = state.products.find((row) => row.sku === sku);
        const row = draft?.opening_counts?.find((entry) => entry.sku === sku);
        const size = sizeLabel(sku, product?.category, product?.name);
        return {
          sku,
          text: staffSkuText(sku, size),
          name: product?.name ?? productName(state, sku),
          price_cents: sellingPriceCents(state, sku, raw),
          counted_qty: row && !row.accepted_as_is ? row.counted_qty : null,
          locked: false,
        };
      }),
      opening_off: reveal ? offCount(openingLines) : 0,
      opening_lines: reveal ? openingLines : [],
    },
    stock_check: {
      opening: { offCount: reveal ? offCount(openingLines) : 0, ready: reveal, lines: reveal ? openingLines : [] },
      closing: { offCount: offCount(closingLines), ready: closingReady, lines: closingLines },
      refills,
    },
    verify_admin: demo
      ? {
          opening: skus.map((sku) => {
            const row = draft?.opening_counts?.find((entry) => entry.sku === sku);
            const expected = row?.expected_qty ?? expectedAtSubmit(state, shift, sku, now.getTime());
            const counted = row?.counted_qty ?? null;
            const off = counted == null ? 0 : counted - expected;
            return { ...staffOffLine(state, sku, off), counted, expected, added_stock: Boolean(row?.added_stock), accepted_as_is: Boolean(row?.accepted_as_is), frozen: row?.expected_qty != null && !row.accepted_as_is };
          }),
          closing: closePlan.map((line) => {
            const counted = draft?.counts.find((row) => row.sku === line.sku)?.counted_qty ?? null;
            const off = counted == null ? 0 : counted - line.expected_qty;
            return { ...staffOffLine(state, line.sku, off), counted, expected: line.expected_qty };
          }),
        }
      : undefined,
  };
}

function refillIssues(state: State, shiftId: string, raw?: Map<string, number>) {
  const grouped = new Map<string, { sent: number; received: number }>();
  for (const row of state.incoming) {
    if (row.confirmed_shift_id !== shiftId) continue;
    if (row.status !== "CONFIRMED" && row.status !== "PARTIAL" && row.status !== "REJECTED") continue;
    const current = grouped.get(row.sku) ?? { sent: 0, received: 0 };
    current.sent += row.qty_sent;
    current.received += row.qty_received ?? 0;
    grouped.set(row.sku, current);
  }
  const lines = sortCountSkus(state, grouped.keys()).flatMap((sku) => {
    const totals = grouped.get(sku);
    if (!totals || totals.received === totals.sent) return [];
    const product = state.products.find((row) => row.sku === sku);
    const size = sizeLabel(sku, product?.category, product?.name);
    const diff = totals.received - totals.sent;
    return [{ sku, text: staffSkuText(sku, size), sent: totals.sent, received: totals.received, diff, cents: diff * shelfCents(state, sku, raw) }];
  });
  return { count: lines.length, lines };
}

function previousClosing(state: State, shift: ShiftRow) {
  const previous = state.shifts
    .filter((row) => row.store_code === shift.store_code && row.id !== shift.id && row.status === "ENDED" && row.ended_at)
    .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
  if (!previous) return null;
  return state.closings.find((row) => row.shift_id === previous.id) ?? null;
}

function floatCheck(state: State, shift: ShiftRow) {
  const previous = previousClosing(state, shift);
  const draft = draftsOf(state).find((row) => row.shift_id === shift.id);
  if (!previous) return { required: false, done: true, expected_cents: 0, found_cents: null as number | null };
  return {
    required: true,
    done: draft?.float_found_cents != null,
    expected_cents: previous.float_cents ?? 0,
    found_cents: draft?.float_found_cents ?? null,
  };
}

function countSkus(state: State, shift?: ShiftRow) {
  const skus = new Set<string>();
  for (const balance of state.balances) skus.add(balance.sku);
  for (const product of state.products) {
    const storeProduct = state.store_products.find((item) => item.store_code === tillCode() && item.sku === product.sku);
    if (product.setb_active && storeProduct?.enabled) skus.add(product.sku);
  }
  return [...skus].filter((sku) => visibleForShift(state, shift, sku)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
    `${currentStore().label} shift closed – ${staffPos} ${formatStoreTime(shift.started_at)}–${formatStoreTime(shift.ended_at ?? closing.created_at)} (America/Toronto)`,
    shift.weed_in_store == null ? "" : `WEED in store this shift: ${shift.weed_in_store ? "WEED" : "NO WEED"}`,
    `Sales: ${formatMoney(closing.sales_total_cents)} (${closing.sale_count} sales, ${closing.void_count} void) · COH: ${formatMoney(closing.cash_on_hand_cents)} · Deposited: ${formatMoney(closing.deposited_cents)}`,
    `Cash: ${formatMoney(closing.cash_sales_cents ?? closing.sales_total_cents)} · Debit: ${formatMoney(closing.debit_sales_cents ?? 0)} · Shortage: ${formatMoney(closing.shortage_cents ?? 0)} · Overage: ${formatMoney(closing.overage_cents ?? 0)} · Balance: ${formatMoney(closing.balance_cents ?? 0)}`,
    `Tickets: ${closing.tickets_total} (${closing.tickets_cashed_out} cashed, ${closing.tickets_expired} expired)`,
    `Left: ${shown}${more}`,
    closing.close_label ? `Close: ${closing.close_label}` : "",
    closing.no_count ? "No count taken" : "",
  ].filter(Boolean).join("\n");
}

function buildClosing(state: State, shift: ShiftRow, lines: ClosingLine[], noCount: boolean, at: string, finalDepositCents = 0, floatCents = 0): ClosingRow {
  const totals = shiftTotals(state, shift.id);
  const tickets = ticketStats(state, shift.id);
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  const shortage = lines.reduce((sum, line) => sum + (line.shortage_cents ?? 0), 0);
  const overage = lines.reduce((sum, line) => sum + (line.overage_cents ?? 0), 0);
  const base = {
    shift_id: shift.id,
    sales_total_cents: totals.sales_total_cents,
    cash_sales_cents: totals.cash_sales_cents,
    debit_sales_cents: totals.debit_sales_cents,
    sale_count: totals.sale_count,
    void_count: totals.void_count,
    cash_on_hand_cents: totals.cash_on_hand_cents,
    deposited_cents: totals.deposited_cents,
    final_deposit_cents: finalDepositCents,
    float_cents: floatCents,
    shortage_cents: shortage,
    overage_cents: overage,
    balance_cents: closingBalance({
      cash_sales_cents: totals.cash_sales_cents,
      shortage_cents: shortage,
      overage_cents: overage,
      deposited_cents: totals.deposited_cents,
    }),
    tickets_total: tickets.total,
    tickets_cashed_out: tickets.cashed,
    tickets_expired: tickets.expired,
    closing_lines: lines,
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: noCount,
    created_at: at,
    close_label: stampCloseLabel(state, shift, at).close_label,
  };
  return { ...base, summary_text: summaryText({ ...shift, ended_at: shift.ended_at ?? at }, staff?.pos_id ?? "", base) };
}

function finishShift(state: State, shift: ShiftRow, reason: string, at: string, closing: ClosingRow) {
  expireTickets(state, Date.parse(at), shift.id);
  const fresh = buildClosing(state, shift, closing.closing_lines, closing.no_count, at, closing.final_deposit_cents ?? 0, closing.float_cents ?? 0);
  shift.status = "ENDED";
  shift.ended_at = at;
  shift.end_reason = reason;
  shift.pin_hash = null;
  shift.pin_expires_at = at;
  revokeSessions(state, shift.id, at);
  fresh.summary_text = summaryText(shift, state.staff.find((row) => row.staff_uid === shift.staff_uid)?.pos_id ?? "", fresh);
  if (!state.closings.some((row) => row.shift_id === shift.id)) {
    state.closings.push(fresh);
    queueCloseSnapshot(state, shift, fresh, fresh.closing_lines);
  }
  return fresh;
}

function noCountLines(state: State, shift: ShiftRow): ClosingLine[] {
  return countSkus(state, shift).map((sku) => ({ sku, name: productName(state, sku), left: qtyOf(state, sku), system_qty: qtyOf(state, sku) }));
}

function queueClosingSheets(state: State, shift: ShiftRow, closing: ClosingRow, at: string) {
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  enqueue(state, "S_Shifts", `SH-${shift.id}`, {
    row_id: `SH-${shift.id}`,
    shift_id: shift.sccx_shift_id,
    store_code: tillCode(),
    staff_pos_id: staff?.pos_id ?? "",
    staff_name: staff?.display_name ?? "",
    status: shift.status,
    start: shift.started_at,
    end: shift.ended_at ?? "",
    end_reason: shift.end_reason ?? "",
  }, at);
  for (const line of closing.closing_lines) {
    enqueue(state, "S_ClosingCounts", `CC-${shift.id}-${line.sku}`, {
      row_id: `CC-${shift.id}-${line.sku}`,
      store_code: tillCode(),
      shift_id: shift.sccx_shift_id,
      sku: line.sku,
      system_qty: String(line.system_qty),
      left_qty: String(line.left),
      expected_qty: String(line.expected_qty ?? line.system_qty),
      variance_qty: String(line.variance_qty ?? line.left - line.system_qty),
      price: centsToSheet(line.price_cents ?? 0),
      shortage: centsToSheet(line.shortage_cents ?? 0),
      overage: centsToSheet(line.overage_cents ?? 0),
      at,
    }, at);
  }
  enqueue(state, "S_ShiftSummary", `SS-${shift.id}`, {
    row_id: `SS-${shift.id}`,
    store_code: tillCode(),
    shift_id: shift.sccx_shift_id,
    staff_pos_id: staff?.pos_id ?? "",
    start: shift.started_at,
    end: shift.ended_at ?? at,
    sales_total: centsToSheet(closing.sales_total_cents),
    cash_sales: centsToSheet(closing.cash_sales_cents ?? closing.sales_total_cents),
    debit_sales: centsToSheet(closing.debit_sales_cents ?? 0),
    sale_count: String(closing.sale_count),
    voids: String(closing.void_count),
    cash_on_hand: centsToSheet(closing.cash_on_hand_cents),
    deposited: centsToSheet(closing.deposited_cents),
    final_deposit: centsToSheet(closing.final_deposit_cents ?? 0),
    shortage: centsToSheet(closing.shortage_cents ?? 0),
    overage: centsToSheet(closing.overage_cents ?? 0),
    balance: centsToSheet(closing.balance_cents ?? 0),
    tickets: String(closing.tickets_total),
    no_count: closing.no_count ? "true" : "false",
    variance: closing.closing_lines
      .filter((line) => (line.shortage_cents ?? 0) > 0 || (line.overage_cents ?? 0) > 0)
      .map((line) => `${line.sku} ${line.name} expected ${line.expected_qty ?? ""} counted ${line.left} short ${centsToSheet(line.shortage_cents ?? 0)} over ${centsToSheet(line.overage_cents ?? 0)}`)
      .join(" | "),
  }, at);
  queueSnapshot(state, at);
}

function queueSnapshot(state: State, at: string) {
  if (tillCode() !== "PNY01") return;
  for (const product of state.products) {
    const storeProduct = state.store_products.find((item) => item.store_code === tillCode() && item.sku === product.sku);
    enqueue(state, "Products", `P-${product.sku}`, {
      row_id: `P-${product.sku}`,
      sku: product.sku,
      name: product.name,
      category: product.category,
      active: product.setb_active && storeProduct?.enabled ? "true" : "false",
      price_cad: centsToSheet(storeProduct?.price_override_cents ?? product.default_price_cents),
      price_label: "CAD",
      image: product.image_url ?? "",
    }, at);
    enqueue(state, "S_Stock", `ST-${tillCode()}-${product.sku}`, {
      row_id: `ST-${tillCode()}-${product.sku}`,
      store_code: tillCode(),
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
    store_code: tillCode(),
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
  return state.shifts.filter((shift) => shift.store_code === tillCode() && shift.status !== "ENDED");
}

function requireSession(state: State, token: string, now: Date, opts?: { demo: boolean; secret: string; gate?: "pos" | "kitchen" | "any" }) {
  const want = opts?.gate ?? "pos";
  if (opts?.demo && token.startsWith("v1.")) {
    const ticket = readStaffSession(token, opts.secret, now.getTime());
    if (!ticket || ticket.store !== tillCode()) {
      throw new PosError(401, "SESSION_REJECTED", "The till session was not accepted. Sign in again.");
    }
    const gate = ticket.gate ?? "pos";
    if (want !== "any" && gate !== want) {
      throw new PosError(401, "SESSION_REJECTED", "This sign-in is for a different screen.");
    }
    const shift = state.shifts.find((row) => row.sccx_shift_id === ticket.shift || row.id === ticket.shift);
    if (!shift || shift.store_code !== tillCode()) throw new PosError(401, "NO_SHIFT", "No demo shift is open on this server. Sign in again.");
    if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") {
      throw new PosError(401, "SHIFT_ENDED", "This shift has ended. Sign in again with the demo PIN.");
    }
    const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
    if (!staff?.active) throw new PosError(401, "NO_SESSION", "Staff record is inactive.");
    return {
      session: { id: "signed", shift_id: shift.id, token_hash: sha256(token), expires_at: new Date(ticket.exp * 1000).toISOString(), revoked_at: null, created_at: iso(now) },
      shift,
      staff,
    };
  }
  if (want === "kitchen") throw new PosError(401, "NO_SESSION", "Sign in with the kitchen PIN.");
  const session = state.sessions.find((row) => row.token_hash === sha256(token) && !row.revoked_at && Date.parse(row.expires_at) > now.getTime());
  if (session) {
    const shift = state.shifts.find((row) => row.id === session.shift_id);
    if (!shift || shift.store_code !== tillCode() || (!session.master && shift.status !== "ACTIVE" && shift.status !== "CLOSING")) {
      throw new PosError(401, "SHIFT_ENDED", "This shift has ended. Sign in again.");
    }
    const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
    if (!staff || (!session.master && !staff.active)) throw new PosError(401, "NO_SESSION", "Staff record is inactive.");
    return { session, shift, staff };
  }
  throw new PosError(401, "NO_SESSION", "Sign in again. This server does not have that session.");
}

function requireAdmin(state: State, token: string, now: Date) {
  const session = state.admin_sessions.find((row) => row.token_hash === sha256(token) && Date.parse(row.expires_at) > now.getTime());
  if (!session) throw new PosError(403, "ADMIN_ONLY", "Admin sign-in is required.");
  return session;
}

function sellingBlocked(_state: State, shift: ShiftRow) {
  if (shift.status !== "ACTIVE") return "SHIFT_NOT_ACTIVE";
  if (weedAnswerRequired(shift)) return "WEED_ANSWER_REQUIRED";
  return null;
}

/** Selling does not wait on an opening count. Pending refills stay pending until staff receive them. */
function openTillWithoutCount(shift: ShiftRow, at: string) {
  if (!shift.opening_confirmed_at) shift.opening_confirmed_at = at;
}

function ensureQuotedProduct(state: State, sku: string, at: string) {
  const quote = quoteForSku(sku);
  if (!quote || quote.cents <= 0) return;
  let product = state.products.find((row) => row.sku === sku);
  if (!product) {
    product = {
      sku,
      sku_sort: skuSortKey(sku),
      name: quote.name,
      category: quote.category,
      default_price_cents: quote.cents,
      image_url: quote.image,
      setb_active: true,
      synced_at: at,
      created_at: at,
    };
    state.products.push(product);
  } else if (product.default_price_cents <= 0) {
    product.default_price_cents = quote.cents;
    product.name = quote.name;
    product.category = quote.category;
    product.setb_active = true;
  }
  const storeProduct = state.store_products.find((row) => row.store_code === tillCode() && row.sku === sku);
  if (!storeProduct) {
    state.store_products.push({
      store_code: tillCode(),
      sku,
      enabled: true,
      price_override_cents: null,
      created_at: at,
      updated_at: at,
    });
  } else if (!storeProduct.enabled && !isCigaretteCategory(product.category)) {
    storeProduct.enabled = true;
    storeProduct.updated_at = at;
  }
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
  const balances = state.balances.filter((row) => balanceForStore(row, "PNY01"));
  const ledgerRows = state.ledger.filter((row) => balanceForStore(row, "PNY01"));
  const skus = new Set<string>([...balances.map((row) => row.sku), ...ledgerRows.map((row) => row.sku)]);
  const rows = [...skus].sort().map((sku) => {
    const entries = ledgerRows.filter((row) => row.sku === sku);
    const sum = (type: MovementType) => entries.filter((row) => row.movement_type === type).reduce((total, row) => total + row.qty_delta, 0);
    const parts = {
      opening: sum("OPENING_BALANCE"),
      incoming: sum("INCOMING_CONFIRM"),
      sales: sum("SALE"),
      voids: sum("VOID"),
      adjustments: sum("ADJUSTMENT") + sum("COUNT_VARIANCE"),
    };
    const formula = parts.opening + parts.incoming + parts.sales + parts.voids + parts.adjustments;
    const balance = balances.find((row) => row.sku === sku)?.qty ?? 0;
    const ledgerSum = entries.reduce((total, row) => total + row.qty_delta, 0);
    return { sku, balance, ledger_sum: ledgerSum, formula, ...parts, ok: ledgerSum === balance && formula === balance && balance >= 0 };
  });
  const shifts = state.shifts.map((shift) => {
    const totals = shiftTotals(state, shift.id);
    return { shift_id: shift.id, ...totals, cash_ok: totals.cash_sales_cents - totals.deposited_cents === totals.cash_on_hand_cents };
  });
  return { ok: rows.every((row) => row.ok) && shifts.every((shift) => shift.cash_ok), skus: rows, shifts, cash_ok: shifts.every((shift) => shift.cash_ok) };
}

/** First completed sale whose lines are exactly 10 red Goose Full and 10 blue Goose Lights. */
function gooseCartonSale(state: State, shiftId: string) {
  const sales = state.sales
    .filter((sale) => sale.shift_id === shiftId && sale.status === "COMPLETED")
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return sales.find((sale) => {
    const lines = state.sale_lines.filter((line) => line.sale_id === sale.id);
    if (lines.length !== 2) return false;
    const qty = new Map(lines.map((line) => [line.sku, line.qty]));
    return qty.size === 2 && qty.get("1011") === 10 && qty.get("1012") === 10;
  });
}

function describeShiftSale(state: State, sale: State["sales"][number]) {
  const seller = state.staff.find((row) => row.staff_uid === sale.staff_uid);
  const ticket = sale.ticket_id ? state.tickets.find((row) => row.id === sale.ticket_id) : undefined;
  return {
    id: sale.id,
    order_no: sale.ref_no,
    at: sale.created_at,
    cursor: `${sale.created_at}|${sale.id}`,
    status: sale.status,
    payment: sale.payment_method === "DEBIT" ? "debit" as const : "cash" as const,
    total_cents: sale.total_cents,
    staff_name: seller?.display_name ?? "",
    ticket_no: ticket?.code ?? null,
    items: state.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => {
      const product = state.products.find((row) => row.sku === line.sku);
      return {
        sku: line.sku,
        name: product?.name ?? productName(state, line.sku),
        size: sizeLabel(line.sku, product?.category, product?.name),
        qty: line.qty,
        line_price_cents: line.line_total_cents,
      };
    }),
  };
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
    store_code: tillCode(),
    shift_id: shift?.sccx_shift_id ?? "",
    staff_pos_id: staff?.pos_id ?? "",
    staff_name: staff?.display_name ?? "",
    total: centsToSheet(sale.total_cents),
    lines: lines.map((line) => `${line.sku}x${line.qty}@${centsToSheet(line.unit_price_cents)}`).join(" | "),
    status: sale.status,
    prices_tax_included: sale.prices_tax_included ? "true" : "false",
    payment_method: sale.payment_method,
    at: sale.created_at,
  };
}

export class PosService {
  private menuCache: { gen: number; at: number; body: Json; store: string } | null = null;
  private menuGen = 0;
  private hits = new Map<string, number[]>();
  private kitchenFails = 0;
  private kitchenLocked = false;
  private rawPriceCache: { at: number; map: Map<string, number>; notes: Map<string, string>; items: ItemIndex } | null = null;
  private rawPriceFlight: Promise<Map<string, number>> | null = null;
  private flowerCache: { at: number; index: FlowerIndex } | null = null;
  private flowerFlight: Promise<FlowerIndex> | null = null;
  private masterCache: { at: number; map: Map<string, MasterProduct> } | null = null;
  private db: PosDb;
  private deps: PosDeps;

  constructor(db: PosDb, deps: PosDeps) {
    this.db = db;
    this.deps = deps;
    db.onCommit = (state) => {
      if (!this.deps.sheet.configured) return;
      const rows = takeStockHistory(state);
      if (rows.length) void this.deps.sheet.appendStockHistory(rows).catch(() => undefined);
      const labels = takeNewStockLabels(state);
      if (labels.length && this.deps.sheet.appendStockLabels) void this.deps.sheet.appendStockLabels(labels).catch(() => undefined);
      const snapshots = takeCloseSnapshots(state);
      if (snapshots.length && this.deps.sheet.appendCloseSnapshots) void this.deps.sheet.appendCloseSnapshots(snapshots).catch(() => undefined);
    };
  }

  private now() {
    return this.deps.now?.() ?? new Date();
  }

  /**
   * Read Items_raw_price.Unit_Price. Missing SETB rows are appended, never deleted.
   * A failed read keeps the last good cache.
   */
  private async rawUnitPrices() {
    const now = this.now().getTime();
    if (this.rawPriceCache && now - this.rawPriceCache.at < RAW_PRICE_TTL_MS) return this.rawPriceCache.map;
    if (this.rawPriceFlight) return this.rawPriceFlight;
    this.rawPriceFlight = (async () => {
      try {
        if (this.deps.sheet.configured && this.deps.sheet.readGrid && this.deps.sheet.repairPriceGrid) {
          try {
            await syncItemsRawPrice(this.deps.sheet as Parameters<typeof syncItemsRawPrice>[0]);
          } catch {
            // The menu still sells rows already on the sheet.
          }
        }
        const rows = await this.deps.sheet.readRows("Items_raw_price");
        const map = unitPricesFromRawRows(rows);
        const notes = cartonNotesFromRawRows(rows);
        const items = itemsFromPriceSheetRows(rows);
        this.rawPriceCache = { at: now, map, notes, items };
        return map;
      } catch (error) {
        if (error instanceof SheetUnavailable) return this.rawPriceCache?.map ?? new Map();
        throw error;
      } finally {
        this.rawPriceFlight = null;
      }
    })();
    return this.rawPriceFlight;
  }

  private async rawCartonNotes() {
    await this.rawUnitPrices();
    return this.rawPriceCache?.notes ?? new Map<string, string>();
  }

  /**
   * Flower names, tiers, prices, and pictures. Reads the PNY Flowers_Raw mirror.
   * A missing or empty mirror keeps the current product. Production may copy the
   * published flower table into that mirror once. It does not write SETB or the shift.
   */
  private async flowerIndex() {
    const now = this.now().getTime();
    if (this.flowerCache && now - this.flowerCache.at < RAW_PRICE_TTL_MS) return this.flowerCache.index;
    if (this.flowerFlight) return this.flowerFlight;
    this.flowerFlight = this.loadFlowerIndex(now).finally(() => {
      this.flowerFlight = null;
    });
    return this.flowerFlight;
  }

  private async loadFlowerIndex(now: number) {
    const readGrid = this.deps.sheet.readGrid?.bind(this.deps.sheet);
    let index: FlowerIndex = new Map();
    let mirrorMissing = false;
    let mirrorRead = false;
    if (readGrid) {
      try {
        index = flowersFromGrid(await readGrid("Flowers_Raw"));
        mirrorRead = true;
      } catch (error) {
        const status = error instanceof SheetUnavailable ? error.httpStatus : null;
        mirrorMissing = status === 400 || status === 404;
        if (!mirrorMissing && this.flowerCache?.index.size) return this.flowerCache.index;
      }
    }
    if (index.size === 0 && (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview")) {
      try {
        const grid = await fetchPublishedFlowerGrid();
        const published = flowersFromGrid(grid);
        if (published.size > 0) {
          if ((mirrorMissing || mirrorRead) && this.deps.sheet.configured && process.env.VERCEL_ENV === "production" && process.env.PNY_SHEET_READ_ONLY !== "1") {
            try {
              await this.deps.sheet.writeGrid?.("Flowers_Raw", grid);
            } catch {
              // The names still come from the read. The mirror can be filled on a later request.
            }
          }
          index = published;
        }
      } catch {
        if (this.flowerCache?.index.size) return this.flowerCache.index;
      }
    }
    this.flowerCache = { at: now, index };
    return index;
  }

  /** Product names, photos, and tier prices from the sheet catalog. Read only. On-hand stays in this till. */
  private async sheetMasters() {
    const now = this.now().getTime();
    if (this.masterCache && now - this.masterCache.at < RAW_PRICE_TTL_MS) return this.masterCache.map;
    const map = new Map<string, MasterProduct>();
    if (!this.deps.sheet.configured) return map;
    try {
      const rows = await this.deps.sheet.readRows("POS_Staff");
      const parts = rows
        .filter((row) => row.record_type === "STATE" && String(row.row_id ?? "").startsWith("STATE-") && row.doc)
        .sort((a, b) => String(a.row_id).localeCompare(String(b.row_id)));
      if (parts.length === 0) return map;
      const parsed = JSON.parse(parts.map((row) => row.doc).join("")) as State;
      const code = tillCode();
      for (const product of parsed.products ?? []) {
        const store = (parsed.store_products ?? []).find((item) => item.sku === product.sku && (code === "PNY01" ? !item.store_code || item.store_code === "PNY01" : item.store_code === code));
        if (store && !store.enabled) continue;
        map.set(product.sku, { product, enabled: true, override: store?.price_override_cents ?? null });
      }
    } catch {
      return this.masterCache?.map ?? map;
    }
    this.masterCache = { at: now, map };
    return map;
  }

  /** Non-flower names, prices, and pictures from Items_raw_price. An empty sheet keeps the current catalog. */
  private async itemIndex() {
    await this.rawUnitPrices();
    return this.rawPriceCache?.items ?? new Map();
  }

  private demoPinAllowed() {
    return Boolean(this.deps.demo);
  }

  private session(state: State, token: string, now: Date, gate: "pos" | "kitchen" | "any" = "pos") {
    this.ensurePny2(state, iso(now));
    return requireSession(state, token, now, { demo: this.demoPinAllowed(), secret: this.deps.secrets.session, gate });
  }

  private reopenDemoShift(state: State, now: Date) {
    if (tillCode() === "PNY02") return this.reopenPny2Demo(state, now);
    const shift = state.shifts.find((row) => row.sccx_shift_id === "demo-shift-1")
      ?? state.shifts.find((row) => row.store_code === tillCode());
    if (!shift) return null;
    const at = iso(now);
    if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") {
      shift.status = "ACTIVE";
      shift.ended_at = null;
      shift.end_reason = null;
      shift.pin_failed_attempts = 0;
      if (!shift.opening_confirmed_at) shift.opening_confirmed_at = at;
    }
    if (!shift.pin_expires_at || Date.parse(shift.pin_expires_at) <= now.getTime()) {
      shift.pin_expires_at = iso(new Date(now.getTime() + PIN_TTL_MS));
    }
    return shift;
  }

  /** Second store row, catalog flags, and the demo till. Does nothing on PNY01. */
  private ensurePny2(state: State, at: string) {
    if (tillCode() !== "PNY02") return;
    if (!state.stores.some((row) => row.code === "PNY02")) {
      const sample = state.stores.find((row) => row.code === "PNY01");
      state.stores.push({
        code: "PNY02",
        name: "PNY2",
        active: true,
        timezone: sample?.timezone ?? "America/Toronto",
        prices_tax_included: sample?.prices_tax_included ?? true,
        ticket_letter_seq: 0,
        created_at: at,
      });
    }
    for (const row of [...state.store_products]) {
      if (row.store_code !== "PNY01") continue;
      if (state.store_products.some((item) => item.store_code === "PNY02" && item.sku === row.sku)) continue;
      state.store_products.push({ ...row, store_code: "PNY02", created_at: at, updated_at: at });
    }
  }

  private reopenPny2Demo(state: State, now: Date) {
    const at = iso(now);
    this.ensurePny2(state, at);
    if (!state.balances.some((row) => row.store_code === "PNY02")) {
      for (const row of state.balances) {
        if (row.store_code) continue;
        state.balances.push({ ...row, store_code: "PNY02" });
      }
    }
    let shift = state.shifts.find((row) => row.store_code === "PNY02" && (row.status === "ACTIVE" || row.status === "CLOSING"))
      ?? state.shifts.find((row) => row.sccx_shift_id === "demo-shift-pny2");
    const staff = state.staff.find((row) => row.staff_uid === "staff-demo-tri") ?? state.staff[0];
    if (!shift && staff) {
      const store = state.stores.find((row) => row.code === "PNY02");
      const letter = TICKET_LETTERS[(store?.ticket_letter_seq ?? 0) % TICKET_LETTERS.length];
      if (store) store.ticket_letter_seq += 1;
      shift = {
        id: randomUUID(),
        sccx_shift_id: "demo-shift-pny2",
        staff_uid: staff.staff_uid,
        store_code: "PNY02",
        ticket_letter: letter,
        ticket_seq: 0,
        pin_hash: hashPin(DEMO_PIN),
        pin_expires_at: iso(new Date(now.getTime() + PIN_TTL_MS)),
        pin_failed_attempts: 0,
        status: "ACTIVE",
        started_at: at,
        ended_at: null,
        end_reason: null,
        opening_confirmed_at: at,
        refill_confirmed_at: at,
        created_at: at,
      };
      state.shifts.push(shift);
    }
    if (!shift) return null;
    if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") {
      shift.status = "ACTIVE";
      shift.ended_at = null;
      shift.end_reason = null;
      shift.pin_failed_attempts = 0;
      if (!shift.opening_confirmed_at) shift.opening_confirmed_at = at;
    }
    if (!shift.pin_expires_at || Date.parse(shift.pin_expires_at) <= now.getTime()) {
      shift.pin_expires_at = iso(new Date(now.getTime() + PIN_TTL_MS));
    }
    return shift;
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
      store: tillCode(),
      demo: Boolean(this.deps.demo),
      demo_label: this.deps.demo ? DEMO_LABEL : null,
      demo_pin: this.deps.demo?.pin ?? null,
    };
  }

  /** Read-only. A one-store till with no approved opening stock is waiting, never a demo. */
  async publicStatus() {
    const peek = (this.db as { peek?: () => Promise<State> }).peek;
    if (!peek) return { waiting_for_opening: false };
    const state = await peek();
    const open = state.shifts.some((row) => row.store_code === tillCode() && (row.status === "ACTIVE" || row.status === "CLOSING" || row.status === "LOCKED"));
    return { waiting_for_opening: !state.opening_stock_at && !open };
  }

  async startShift(input: { key: string; store?: string; staff_ref?: string; pos_id?: string; shift_id?: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "shift_start", input.key, body, now, this.deps.secrets.shift);
      if (seen) return seen;
      if ((input.store ?? tillCode()) !== tillCode()) throw new PosError(404, "STORE", "This till is PNY01 only.");
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
        const closing = buildClosing(tx.state, previous, noCountLines(tx.state, previous), true, at);
        finishShift(tx.state, previous, "REPLACED", at, closing);
        queueClosingSheets(tx.state, previous, tx.state.closings.find((row) => row.shift_id === previous.id) ?? closing, at);
      }
      const store = tx.state.stores.find((row) => row.code === tillCode());
      if (!store) throw new PosError(404, "STORE", "Store is missing.");
      const letter = TICKET_LETTERS[store.ticket_letter_seq % TICKET_LETTERS.length];
      store.ticket_letter_seq += 1;
      const pin = randomPin();
      const shift: ShiftRow = {
        id: randomUUID(),
        sccx_shift_id: input.shift_id,
        staff_uid: staff.staff_uid,
        store_code: tillCode(),
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
        ...(tillCode() === "PNY01" ? {
          weed_gate_required: true,
          weed_in_store: null,
          weed_answered_at: null,
          weed_answered_by: null,
        } : {}),
        created_at: at,
      };
      tx.state.shifts.push(shift);
      enqueue(tx.state, "S_Shifts", `SH-${shift.id}`, {
        row_id: `SH-${shift.id}`,
        shift_id: shift.sccx_shift_id,
        store_code: tillCode(),
        staff_pos_id: staff.pos_id,
        staff_name: staff.display_name,
        status: shift.status,
        start: shift.started_at,
        end: "",
        end_reason: "",
      }, at);
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

  /** Read-only SCCx preflight. It never opens, closes, or changes a shift. */
  async openShiftStatus() {
    return this.db.transaction(async (tx) => {
      const shift = openShifts(tx.state)[0];
      if (!shift) return { ok: true as const, active: false as const };
      const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
      return {
        ok: true as const,
        active: true as const,
        status: shift.status,
        open_by: staff?.display_name || staff?.pos_id || shift.staff_uid,
        shift_id: shift.id,
      };
    });
  }

  /**
   * Open today's shift with a chosen PIN. The PIN is hashed and is not returned or audited.
   * One open shift per store: an existing open shift is a conflict and is never changed.
   */
  async openShiftWithPin(input: { staff_uid: string; display_name?: string; pos_id?: string; sccx_id?: string; shift_id?: string; pin: string }) {
    if (!/^\d{4}$/.test(input.pin)) throw new PosError(400, "BAD_PIN", "PIN must be 4 digits.");
    const pin = input.pin;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      this.ensurePny2(tx.state, at);
      const staffUid = input.staff_uid.trim();
      if (!staffUid) throw new PosError(400, "STAFF", "staff_uid is required.");
      const existing = openShifts(tx.state)[0];
      if (existing) {
        const openStaff = tx.state.staff.find((row) => row.staff_uid === existing.staff_uid);
        throw new PosError(409, "TILL_OPEN", "The till is already open.", {
          open_by: openStaff?.display_name || openStaff?.pos_id || existing.staff_uid,
        });
      }
      let staff = tx.state.staff.find((row) => row.staff_uid === staffUid || row.sccx_id === staffUid);
      if (!staff) {
        staff = {
          staff_uid: staffUid,
          sccx_id: input.sccx_id?.trim() || staffUid,
          pos_id: input.pos_id?.trim() || "TRI",
          display_name: input.display_name?.trim() || staffUid,
          active: true,
          updated_at: at,
          created_at: at,
        };
        tx.state.staff.push(staff);
      } else {
        staff.active = true;
        if (input.display_name?.trim()) staff.display_name = input.display_name.trim();
        if (input.pos_id?.trim()) staff.pos_id = input.pos_id.trim();
        if (input.sccx_id?.trim()) staff.sccx_id = input.sccx_id.trim();
        staff.updated_at = at;
      }
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      let sccxId = input.shift_id?.trim() || `${tillCode() === "PNY02" ? "pny02" : "pny01"}-${staff.staff_uid}-${day}`;
      if (tx.state.shifts.some((shift) => shift.sccx_shift_id === sccxId)) sccxId = `${sccxId}-${now.getTime().toString(36)}`;
      const store = tx.state.stores.find((row) => row.code === tillCode());
      if (!store) throw new PosError(404, "STORE", "Store is missing.");
      const letter = TICKET_LETTERS[store.ticket_letter_seq % TICKET_LETTERS.length];
      store.ticket_letter_seq += 1;
      const shift: ShiftRow = {
        id: randomUUID(),
        sccx_shift_id: sccxId,
        staff_uid: staff.staff_uid,
        store_code: tillCode(),
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
        ...(tillCode() === "PNY01" ? {
          weed_gate_required: true,
          weed_in_store: null,
          weed_answered_at: null,
          weed_answered_by: null,
        } : {}),
        created_at: at,
      };
      tx.state.shifts.push(shift);
      enqueue(tx.state, "S_Shifts", `SH-${shift.id}`, {
        row_id: `SH-${shift.id}`,
        shift_id: shift.sccx_shift_id,
        store_code: tillCode(),
        staff_pos_id: staff.pos_id,
        staff_name: staff.display_name,
        status: shift.status,
        start: shift.started_at,
        end: "",
        end_reason: "",
      }, at);
      audit(tx.state, "SHIFT_PIN_SET", "shift", shift.id, staff.staff_uid, { sccx_shift_id: shift.sccx_shift_id, ticket_letter: letter }, at);
      return { ok: true as const, staff_name: staff.display_name, expires_at: shift.pin_expires_at, shift_id: shift.id, sccx_shift_id: shift.sccx_shift_id };
    });
  }

  async endShiftFromSccx(input: { key: string; store?: string; shift_id?: string; reason?: string }) {
    const body = input as unknown as Json;
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "shift_end", input.key, body, now, this.deps.secrets.shift);
      if (seen) return seen;
      if ((input.store ?? tillCode()) !== tillCode()) throw new PosError(404, "STORE", "This till is PNY01 only.");
      const shift = tx.state.shifts.find((row) => row.sccx_shift_id === input.shift_id || row.id === input.shift_id);
      if (!shift) throw new PosError(404, "SHIFT", "Shift was not found.");
      const at = iso(now);
      if (shift.status !== "ENDED") {
        const reason = input.reason === "SCCX_AUTOCLOSE" ? "SCCX_AUTOCLOSE" : "SCCX_OFF";
        expireTickets(tx.state, now.getTime(), shift.id);
        const closing = buildClosing(tx.state, shift, noCountLines(tx.state, shift), true, at);
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
    this.hit(`login:${ip || "unknown"}`, 8, 15 * 60 * 1000);
    if (!/^\d{4}$/.test(pin)) throw new PosError(401, "BAD_PIN", "Enter the 4-digit shift PIN.");
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      if (this.demoPinAllowed() && safeEqual(pin, DEMO_PIN)) {
        const shift = this.reopenDemoShift(tx.state, now);
        if (!shift?.pin_expires_at) {
          return { ok: false as const, status: 401, code: "NO_SHIFT", message: "Demo till is not seeded on this server. Reload and try again." };
        }
        const token = signStaffSession({
          v: 1,
          store: tillCode(),
          shift: shift.sccx_shift_id,
          staff: shift.staff_uid,
          exp: Math.floor(Date.parse(shift.pin_expires_at) / 1000),
          demo: true,
          gate: "pos",
        }, this.deps.secrets.session);
        if (!weedAnswerRequired(shift)) startStaffVerify(shift, at);
        tx.state.sessions.push({
          id: randomUUID(),
          shift_id: shift.id,
          token_hash: sha256(token),
          expires_at: shift.pin_expires_at,
          revoked_at: null,
          created_at: at,
        });
        const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
        return { ok: true as const, token, staff_name: staff?.display_name ?? "Demo Budtender", pos_id: staff?.pos_id ?? "DEMO1" };
      }
      for (const shift of openShifts(tx.state)) {
        if (shift.pin_expires_at && Date.parse(shift.pin_expires_at) <= now.getTime()) {
          const closing = buildClosing(tx.state, shift, noCountLines(tx.state, shift), true, at);
          finishShift(tx.state, shift, "EXPIRED", at, closing);
        }
      }
      const master = safeEqual(pin, MASTER_PIN);
      let shift = tx.state.shifts.find((row) => row.store_code === tillCode() && (row.status === "ACTIVE" || row.status === "CLOSING" || row.status === "LOCKED"));
      if (!shift && master) {
        shift = tx.state.shifts
          .filter((row) => row.store_code === tillCode() && row.status === "ENDED")
          .sort((a, b) => (b.ended_at || b.created_at).localeCompare(a.ended_at || a.created_at))[0];
        if (shift) {
          const token = newToken();
          tx.state.sessions.push({
            id: randomUUID(),
            shift_id: shift.id,
            token_hash: sha256(token),
            expires_at: iso(new Date(now.getTime() + PIN_TTL_MS)),
            revoked_at: null,
            created_at: at,
            master: true,
          });
          const staff = tx.state.staff.find((row) => row.staff_uid === shift!.staff_uid);
          return { ok: true as const, token, staff_name: staff?.display_name ?? "", pos_id: staff?.pos_id ?? "" };
        }
      }
      if (!shift) return { ok: false as const, status: 401, code: "NO_SHIFT", message: "No shift is active." };
      if (shift.status === "LOCKED") return { ok: false as const, status: 423, code: "LOCKED", message: "Shift is locked. An admin must reissue the PIN." };
      if (!shift.pin_hash || !shift.pin_expires_at || Date.parse(shift.pin_expires_at) <= now.getTime()) {
        return { ok: false as const, status: 401, code: "PIN_EXPIRED", message: "That PIN has expired." };
      }
      if (!master && !verifyPin(pin, shift.pin_hash)) {
        shift.pin_failed_attempts += 1;
        if (shift.pin_failed_attempts >= MAX_PIN_FAILURES) shift.status = "LOCKED";
        const locked = shift.status === "LOCKED";
        return {
          ok: false as const,
          status: locked ? 423 : 401,
          code: locked ? "LOCKED" : "BAD_PIN",
          message: locked
            ? "Shift is locked after 5 wrong PINs. An admin must reissue the PIN."
            : this.demoPinAllowed()
              ? "That PIN is not correct. This demo uses PIN 6666. Five wrong tries lock the shift."
              : "That PIN is not correct.",
        };
      }
      shift.pin_failed_attempts = 0;
      if (!master && !weedAnswerRequired(shift)) startStaffVerify(shift, at);
      const token = newToken();
      tx.state.sessions.push({
        id: randomUUID(),
        shift_id: shift.id,
        token_hash: sha256(token),
        expires_at: shift.pin_expires_at,
        revoked_at: null,
        created_at: at,
        master,
      });
      nameLiveShift(tx.state, at);
      const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
      return { ok: true as const, token, staff_name: staff?.display_name ?? "", pos_id: staff?.pos_id ?? "" };
    });
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    return result;
  }

  async kitchenLogin(pin: string, ip: string) {
    this.hit(`kitchen:${ip || "unknown"}`, 8, 15 * 60 * 1000);
    if (!/^\d{4}$/.test(pin)) throw new PosError(401, "BAD_PIN", "Enter the 4-digit kitchen PIN.");
    if (this.kitchenLocked) throw new PosError(423, "LOCKED", "Kitchen is locked after 5 wrong PINs.");
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      if (!(this.demoPinAllowed() && safeEqual(pin, KITCHEN_PIN))) return { ok: false as const, fail: true as const };
      const shift = this.reopenDemoShift(tx.state, now);
      if (!shift?.pin_expires_at) {
        return { ok: false as const, fail: false as const, status: 401, code: "NO_SHIFT", message: "Demo kitchen is not seeded on this server. Reload and try again." };
      }
      const token = signStaffSession({
        v: 1,
        store: tillCode(),
        shift: shift.sccx_shift_id,
        staff: shift.staff_uid,
        exp: Math.floor(Date.parse(shift.pin_expires_at) / 1000),
        demo: true,
        gate: "kitchen",
      }, this.deps.secrets.session);
      tx.state.sessions.push({
        id: randomUUID(),
        shift_id: shift.id,
        token_hash: sha256(token),
        expires_at: shift.pin_expires_at,
        revoked_at: null,
        created_at: at,
      });
      const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
      return { ok: true as const, token, staff_name: staff?.display_name ?? "Demo Budtender" };
    });
    if (!result.ok && result.fail) {
      this.kitchenFails += 1;
      if (this.kitchenFails >= MAX_PIN_FAILURES) this.kitchenLocked = true;
      if (this.kitchenLocked) throw new PosError(423, "LOCKED", "Kitchen is locked after 5 wrong PINs.");
      throw new PosError(401, "BAD_PIN", "That PIN is not correct.");
    }
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    this.kitchenFails = 0;
    return result;
  }

  async logout(token: string) {
    await this.db.transaction(async (tx) => {
      const session = tx.state.sessions.find((row) => row.token_hash === sha256(token) && !row.revoked_at);
      if (session) session.revoked_at = iso(this.now());
    });
    return { ok: true };
  }

  /** Save the required PNY01 shift answer without changing stock, sales, counts, refills, or the PIN. */
  async answerWeedInStore(token: string, weedInStore: boolean) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      if (tillCode() !== "PNY01" || shift.store_code !== "PNY01" || shift.weed_gate_required !== true) {
        throw new PosError(404, "WEED_GATE", "This question is only used by new PNY01 shifts.");
      }
      if (shift.weed_in_store != null) {
        if (shift.weed_in_store !== weedInStore) throw new PosError(409, "WEED_ANSWER_FINAL", "The WEED / NO WEED answer is already saved for this shift.");
        return { ok: true as const, weed_in_store: shift.weed_in_store, answered_at: shift.weed_answered_at, shift_id: shift.sccx_shift_id };
      }
      const stockBefore = JSON.stringify(tx.state.balances);
      const salesBefore = JSON.stringify(tx.state.sales);
      const countsBefore = JSON.stringify(tx.state.counts);
      const pinBefore = shift.pin_hash;
      shift.weed_in_store = weedInStore;
      shift.weed_answered_at = at;
      shift.weed_answered_by = staff.staff_uid;
      startStaffVerify(shift, at);
      openTillWithoutCount(shift, at);
      audit(tx.state, "WEED_SHIFT_ANSWER", "shift", shift.id, staff.staff_uid, {
        shift_id: shift.sccx_shift_id,
        answer: weedInStore ? "WEED" : "NO WEED",
        answered_at: at,
      }, at);
      if (
        JSON.stringify(tx.state.balances) !== stockBefore
        || JSON.stringify(tx.state.sales) !== salesBefore
        || JSON.stringify(tx.state.counts) !== countsBefore
        || shift.pin_hash !== pinBefore
      ) throw new PosError(409, "WEED_GATE_WRITE", "Saving the answer must not change till data.");
      return { ok: true as const, weed_in_store: weedInStore, answered_at: at, shift_id: shift.sccx_shift_id };
    });
  }

  async state(token: string, journal?: DemoJournalOrder[], gate: "pos" | "kitchen" = "pos") {
    const [raw, flowers, items, masters] = await Promise.all([this.rawUnitPrices(), this.flowerIndex(), this.itemIndex(), this.sheetMasters()]);
    return this.db.transaction(async (tx) => {
      const now = this.now();
      if (tillCode() === "PNY02" && this.db instanceof SheetDb) await this.db.pullPny2Stock(tx.state);
      absorbDemoJournal(tx.state, journal);
      expireTickets(tx.state, now.getTime());
      const { shift, staff, session } = this.session(tx.state, token, now, gate);
      const master = Boolean(session.master);
      if (!master && !weedAnswerRequired(shift)) {
        nameLiveShift(tx.state, iso(now));
        openTillWithoutCount(shift, iso(now));
      }
      const totals = shiftTotals(tx.state, shift.id);
      let products = tx.state.products
        .filter((product) => product.setb_active)
        .flatMap((product) => {
          const storeProduct = tx.state.store_products.find((item) => item.store_code === tillCode() && item.sku === product.sku);
          if (!storeProduct?.enabled) return [];
          const fromSheet = raw.get(product.sku);
          const pack = cigarettePackCents(product.sku, product.category, product.name);
          const price = pack ?? fromSheet ?? storeProduct.price_override_cents ?? product.default_price_cents;
          const item = presentCatalogItem({ sku: product.sku, sku_sort: product.sku_sort, name: product.name, category: product.category, price_cents: price, price_source: pack != null || fromSheet != null ? "RAW_UNIT" : "MENU", image_url: product.image_url, qty: qtyOf(tx.state, product.sku) }, flowers, items);
          return [item];
        })
        .sort((a, b) => a.sku_sort - b.sku_sort || a.sku.localeCompare(b.sku));
      const seen = new Set(products.map((product) => product.sku));
      for (const extra of [...stockedCatalogRows(tx.state, items), ...stockedMasterRows(tx.state, masters, flowers, items)]) {
        if (seen.has(extra.sku)) continue;
        seen.add(extra.sku);
        products.push({ ...extra, sku_sort: extra.sku_sort ?? skuSortKey(extra.sku), price_source: "RAW_UNIT" });
      }
      products = products.filter((product) => visibleForShift(tx.state, shift, product.sku));
      const incoming = tx.state.incoming
        .filter((row) => row.status === "PENDING_CONFIRM" && row.qty_sent > 0)
        .map((row) => {
          const product = tx.state.products.find((item) => item.sku === row.sku);
          const size = sizeLabel(row.sku, product?.category, product?.name);
          return { kitchen_row_id: row.kitchen_row_id, sku: row.sku, text: staffSkuText(row.sku, size), qty_sent: row.qty_sent, kind: row.kind };
        })
        .sort((a, b) => compareCount(countMeta(tx.state, a.sku), countMeta(tx.state, b.sku)) || a.kitchen_row_id.localeCompare(b.kitchen_row_id));
      const tickets = tx.state.tickets
        .filter((ticket) => ticket.shift_id === shift.id && (ticket.status === "PENDING" || ticket.status === "OPEN"))
        .filter((ticket) => tx.state.ticket_lines.filter((line) => line.ticket_id === ticket.id).every((line) => visibleForShift(tx.state, shift, line.sku)))
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
      const openingLines = [...openingPlan(tx.state, raw, shift)].sort((a, b) => compareCount(countMeta(tx.state, a.sku), countMeta(tx.state, b.sku)));
      const phase = weedAnswerRequired(shift) ? "weed" : shift.status === "CLOSING" ? "end" : "sell";
      const counted = collectVerify(tx.state, shift, staff.staff_uid, now, raw, false, !master);
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
        master,
        can_sell: !master && sellingBlocked(tx.state, shift) == null,
        block: master ? "MASTER_VIEW" : sellingBlocked(tx.state, shift),
        shift: {
          id: shift.id,
          sccx_shift_id: shift.sccx_shift_id,
          staff_name: staff.display_name,
          pos_id: staff.pos_id,
          ticket_letter: shift.ticket_letter,
          status: shift.status,
          opening_confirmed: Boolean(shift.opening_confirmed_at),
          pin_expires_at: shift.pin_expires_at,
          weed_in_store: shift.weed_in_store ?? null,
        },
        weed_gate: {
          required: weedAnswerRequired(shift),
          answer: shift.weed_in_store ?? null,
          answered_at: shift.weed_answered_at ?? null,
        },
        totals: {
          sales_cents: totals.sales_total_cents,
          cash_sales_cents: totals.cash_sales_cents,
          debit_sales_cents: totals.debit_sales_cents,
          cash_on_hand_cents: totals.cash_on_hand_cents,
          deposited_cents: totals.deposited_cents,
        },
        deposits: tx.state.deposits
          .filter((row) => row.shift_id === shift.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((row) => ({ id: row.id, deposit_code: row.deposit_code ?? null, amount_cents: row.amount_cents, created_at: row.created_at })),
        categories: inStockCategories(products),
        products,
        count_lines: countSkus(tx.state).map((sku) => ({ sku, name: productName(tx.state, sku), system_qty: qtyOf(tx.state, sku) })),
        opening_lines: openingLines.map((line) => ({
          ...line,
          counted_qty: draftsOf(tx.state).find((row) => row.shift_id === shift.id)?.opening_counts?.find((row) => row.sku === line.sku)?.counted_qty ?? null,
          variance_reason: draftsOf(tx.state).find((row) => row.shift_id === shift.id)?.opening_counts?.find((row) => row.sku === line.sku)?.variance_reason ?? null,
        })),
        close_lines: (() => {
          const draft = draftsOf(tx.state).find((row) => row.shift_id === shift.id);
          return [...shiftClosePlan(tx.state, shift.id, raw)]
            .sort((a, b) => compareCount(countMeta(tx.state, a.sku), countMeta(tx.state, b.sku)))
            .map((line) => {
              const meta = countMeta(tx.state, line.sku);
              const saved = draft?.counts.find((row) => row.sku === line.sku);
              return {
                ...line,
                text: staffSkuText(line.sku, meta.bag),
                system_qty: qtyOf(tx.state, line.sku),
                counted_qty: saved && !saved.accepted_as_is ? saved.counted_qty : null,
              };
            });
        })(),
        closing: (() => {
          const draft = draftsOf(tx.state).find((row) => row.shift_id === shift.id);
          const lines = [...shiftClosePlan(tx.state, shift.id, raw)]
            .sort((a, b) => compareCount(countMeta(tx.state, a.sku), countMeta(tx.state, b.sku)))
            .map((line) => {
              const meta = countMeta(tx.state, line.sku);
              const saved = draft?.counts.find((row) => row.sku === line.sku);
              return {
                sku: line.sku,
                text: staffSkuText(line.sku, meta.bag),
                counted_qty: saved && !saved.accepted_as_is ? saved.counted_qty : null,
              };
            });
          return {
            started: Boolean(draft?.closing_started_at),
            submitted: Boolean(draft?.closing_submitted_at),
            lines,
          };
        })(),
        verify: counted.verify,
        stock_check: counted.stock_check,
        verify_admin: counted.verify_admin,
        final_deposit_cents: draftsOf(tx.state).find((row) => row.shift_id === shift.id)?.final_deposit_cents ?? null,
        float_cents: draftsOf(tx.state).find((row) => row.shift_id === shift.id)?.float_cents ?? 0,
        float_check: floatCheck(tx.state, shift),
        incoming,
        tickets,
        pending_count: pendingCount,
        receipts: tx.state.incoming.map((row) => ({
          kitchen_row_id: row.kitchen_row_id,
          sku: row.sku,
          name: productName(tx.state, row.sku),
          qty_sent: row.qty_sent,
          qty_received: row.qty_received,
          status: row.status,
          kind: row.kind,
          variance_reason: row.variance_reason,
        })),
        sheet_sync_delayed: oldestQueued != null && now.getTime() - oldestQueued >= SHEET_DELAY_MS,
        prices_include_tax: false,
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
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE") throw new PosError(409, "SHIFT_NOT_ACTIVE", "Shift is not open.");
      if (shift.opening_confirmed_at) throw new PosError(409, "OPENING_DONE", "Opening count is already confirmed.");
      const expected = openingPlan(tx.state, undefined, shift).map((line) => line.sku);
      const bySku = new Map(input.lines.map((line) => [line.sku, line]));
      if (expected.some((sku) => !bySku.has(sku))) throw new PosError(400, "INCOMPLETE_COUNT", "Count every SKU that has stock or an incoming refill.");
      const at = iso(now);
      const countId = randomUUID();
      for (const sku of expected) {
        const line = bySku.get(sku)!;
        if (!Number.isInteger(line.counted_qty) || line.counted_qty < 0) throw new PosError(400, "BAD_QTY", "Counted quantity must be a whole number.");
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
          store_code: tillCode(),
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
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "Shift is not open.");
      if (input.lines.length === 0) throw new PosError(400, "EMPTY", "Nothing to confirm.");
      const at = iso(now);
      for (const line of input.lines) {
        const row = tx.state.incoming.find((item) => item.kitchen_row_id === line.kitchen_row_id);
        if (!row || row.status !== "PENDING_CONFIRM") throw new PosError(409, "ALREADY_CONFIRMED", "That incoming row is not waiting.");
        if (!Number.isInteger(line.qty_received) || line.qty_received < 0) throw new PosError(400, "BAD_QTY", "Received quantity must be a whole number.");
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
          const entry = ledger(tx.state, row.sku, line.qty_received, "INCOMING_CONFIRM", "incoming", row.kitchen_row_id, staff.staff_uid, row.variance_reason, shift.id, at);
          row.linked_ledger_id = entry.id;
          ensureQuotedProduct(tx.state, row.sku, at);
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

  async sendRefill(token: string, input: { key: string; kind?: "ALLOCATION" | "REFILL"; lines: { sku: string; qty: number }[] }) {
    const body = input as unknown as Json;
    const kind = input.kind === "ALLOCATION" ? "ALLOCATION" : "REFILL";
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const seen = replay(tx.state, "kitchen_refill", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const { shift, staff, session } = this.session(tx.state, token, now, "any");
      denyMaster(session);
      if (!shift.opening_confirmed_at) throw new PosError(409, "OPENING_REQUIRED", "Confirm the original stock first.");
      const lines = input.lines.filter((line) => line.qty > 0);
      if (lines.length === 0) throw new PosError(400, "EMPTY", "Enter a quantity for at least one item.");
      const at = iso(now);
      const created: { kitchen_row_id: string; sku: string; name: string; qty: number; status: string }[] = [];
      for (const line of lines) {
        if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 999) throw new PosError(400, "BAD_QTY", "Quantity must be a whole number from 1 to 999.");
        const product = tx.state.products.find((item) => item.sku === line.sku && item.setb_active);
        if (!product) throw new PosError(404, "SKU", "That SKU is not in the PNY catalog.");
        const kitchenRowId = randomUUID();
        tx.state.incoming.push({
          kitchen_row_id: kitchenRowId,
          batch_id: input.key,
          store_code: tillCode(),
          sku: line.sku,
          qty_sent: line.qty,
          kind,
          kitchen_created_at: at,
          imported_at: at,
          status: "CONFIRMED",
          qty_received: line.qty,
          variance_reason: null,
          confirmed_shift_id: shift.id,
          confirmed_at: at,
          linked_ledger_id: null,
          created_at: at,
        });
        const next = balanceAdd(tx.state, line.sku, line.qty, at, true);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not receive the refill.");
        const entry = ledger(tx.state, line.sku, line.qty, "INCOMING_CONFIRM", "incoming", kitchenRowId, staff.staff_uid, null, shift.id, at);
        const row = tx.state.incoming.find((item) => item.kitchen_row_id === kitchenRowId)!;
        row.linked_ledger_id = entry.id;
        enqueue(tx.state, "S_Receipts", `R-${kitchenRowId}`, receiptPayload(row, shift.sccx_shift_id, staff.pos_id), at);
        created.push({ kitchen_row_id: kitchenRowId, sku: line.sku, name: product.name, qty: line.qty, status: "CONFIRMED" });
      }
      shift.refill_confirmed_at = at;
      const resultBody = { ok: true, lines: created };
      remember(tx.state, "kitchen_refill", input.key, body, resultBody, now, this.deps.secrets.session);
      return resultBody;
    });
    this.bumpMenu();
    return result;
  }

  async cashout(token: string, input: { key: string; lines: { sku: string; qty: number; unit_price_cents?: number }[]; ticket_id?: string | null; payment_method?: string | null }, journal?: DemoJournalOrder[]) {
    const body = input as unknown as Json;
    const [raw, flowers, items, masters] = await Promise.all([this.rawUnitPrices(), this.flowerIndex(), this.itemIndex(), this.sheetMasters()]);
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      absorbDemoJournal(tx.state, journal);
      const seen = replay(tx.state, "cashout", input.key, body, now, this.deps.secrets.session);
      if (seen) return { committed: true, stockout: false, body: seen };
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      const block = sellingBlocked(tx.state, shift);
      if (block) throw new PosError(409, block, "Shift is not open for sales.");
      const at = iso(now);
      if (input.ticket_id) {
        const ticket = tx.state.tickets.find((row) => row.id === input.ticket_id && row.shift_id === shift.id);
        if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
        if (ticket.status === "CASHED_OUT") {
          const paid = paidSaleBody(tx.state, ticket.id);
          if (!paid) throw new PosError(409, "BAD_TICKET", "That ticket is already paid.");
          return { committed: true, stockout: false, body: paid };
        }
        if (ticket.status === "EXPIRED" || Date.parse(ticket.expires_at) <= now.getTime()) {
          ticket.status = "EXPIRED";
          return { committed: true, stockout: false, body: null, error: new PosError(409, "TICKET_EXPIRED", "That ticket has expired.") };
        }
        if (ticket.status !== "PENDING" && ticket.status !== "OPEN") throw new PosError(409, "BAD_TICKET", "That ticket is not open.");
      }
      const lines = mergeLines(input.lines);
      if (noWeedShift(shift) && lines.some((line) => thcForState(tx.state, line.sku))) {
        throw new PosError(409, "THC_HIDDEN", "THC SKUs are unavailable on a NO WEED shift.");
      }
      const priced = lines.map((line) => {
        const price = priceOf(tx.state, line.sku, raw, flowers, items, masters);
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
      const taxIncluded = priced.some((line) => line.source !== "RAW_UNIT");
      const method = paymentOf(input.payment_method);
      const ref = nextOrderRef(tx.state);
      tx.state.sales.push({
        id: saleId,
        ref_no: ref,
        shift_id: shift.id,
        staff_uid: staff.staff_uid,
        ticket_id: input.ticket_id ?? null,
        total_cents: total,
        prices_tax_included: taxIncluded,
        payment_method: method,
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
        prices_tax_included: taxIncluded,
        payment_method: method,
        lines: priced.map((line) => ({ sku: line.sku, qty: line.qty, unit_price_cents: line.cents, line_total_cents: line.line_total_cents })),
        journal_order: input.ticket_id ? journalFromTicket(tx.state, input.ticket_id) : null,
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
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" || !shift.opening_confirmed_at) throw new PosError(409, "SHIFT_NOT_ACTIVE", "Deposits need an open, counted shift.");
      const amount = roundCents(input.amount_cents);
      if (!Number.isFinite(amount) || amount <= 0) throw new PosError(400, "BAD_AMOUNT", "Enter a deposit greater than zero.");
      const at = iso(now);
      const deposit_code = issueDepositCode(tx.state);
      tx.state.deposits.push({ id: randomUUID(), shift_id: shift.id, staff_uid: staff.staff_uid, amount_cents: amount, note: input.note?.trim() || null, deposit_code, created_at: at });
      const deposit = tx.state.deposits[tx.state.deposits.length - 1]!;
      enqueue(tx.state, "S_Deposits", `D-${deposit.id}`, {
        row_id: `D-${deposit.id}`,
        deposit_id: deposit.id,
        deposit_code,
        store_code: tillCode(),
        shift_id: shift.sccx_shift_id,
        staff_pos_id: staff.pos_id,
        amount: centsToSheet(deposit.amount_cents),
        note: deposit.note ?? "",
        at: deposit.created_at,
      }, at);
      const next = shiftTotals(tx.state, shift.id);
      const result = { ok: true, deposit_code, ...next, sales_cents: next.sales_total_cents };
      remember(tx.state, "deposit", input.key, body, result, now, this.deps.secrets.session);
      return result;
    });
  }

  /** Re-check the shift PIN. Does not issue a session or change the stored PIN. */
  async confirmShiftPin(token: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) throw new PosError(401, "BAD_PIN", "Enter the 4-digit shift PIN.");
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, session } = this.session(tx.state, token, now);
      denyMaster(session);
      if (shift.status === "LOCKED") return { ok: false as const, status: 423, code: "LOCKED", message: "Shift is locked. An admin must reissue the PIN." };
      if (!shift.pin_hash || !shift.pin_expires_at || Date.parse(shift.pin_expires_at) <= now.getTime()) {
        return { ok: false as const, status: 401, code: "PIN_EXPIRED", message: "That PIN has expired." };
      }
      if (!verifyPin(pin, shift.pin_hash)) {
        shift.pin_failed_attempts += 1;
        if (shift.pin_failed_attempts >= MAX_PIN_FAILURES) shift.status = "LOCKED";
        const locked = shift.status === "LOCKED";
        return {
          ok: false as const,
          status: locked ? 423 : 401,
          code: locked ? "LOCKED" : "BAD_PIN",
          message: locked ? "Shift is locked after 5 wrong PINs. An admin must reissue the PIN." : "That PIN is not correct.",
        };
      }
      shift.pin_failed_attempts = 0;
      return { ok: true as const };
    });
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    return result;
  }

  /**
   * Check the staff or master PIN before the till totals.
   * Keeps the current session and does not change the stored PIN.
   */
  async unlockTill(token: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) throw new PosError(401, "BAD_PIN", "Enter the 4-digit shift PIN.");
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, session } = this.session(tx.state, token, now);
      if (shift.status === "LOCKED") return { ok: false as const, status: 423, code: "LOCKED", message: "Shift is locked. An admin must reissue the PIN." };
      if (!shift.pin_hash || !shift.pin_expires_at || Date.parse(shift.pin_expires_at) <= now.getTime()) {
        return { ok: false as const, status: 401, code: "PIN_EXPIRED", message: "That PIN is expired." };
      }
      const masterPin = safeEqual(pin, MASTER_PIN);
      if (!masterPin && !verifyPin(pin, shift.pin_hash)) {
        shift.pin_failed_attempts += 1;
        if (shift.pin_failed_attempts >= MAX_PIN_FAILURES) shift.status = "LOCKED";
        const locked = shift.status === "LOCKED";
        return {
          ok: false as const,
          status: locked ? 423 : 401,
          code: locked ? "LOCKED" : "BAD_PIN",
          message: locked ? "Shift is locked after 5 wrong PINs. An admin must reissue the PIN." : "That PIN is not correct.",
        };
      }
      if (shift.pin_failed_attempts !== 0) shift.pin_failed_attempts = 0;
      return { ok: true as const, view_only: Boolean(session.master) || masterPin };
    });
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    return result;
  }

  /**
   * Read completed sales after an exclusive cursor.
   * Does not change sales, stock, counts, refills, the PIN, or the shift.
   * An empty cursor bootstraps at the latest sale and returns no history.
   */
  async salesFeed(since: string | null, limit = 50) {
    const pageSize = Math.min(50, Math.max(1, Math.trunc(limit) || 50));
    return this.db.transaction(async (tx) => {
      const before = JSON.stringify({
        sales: tx.state.sales,
        lines: tx.state.sale_lines,
        balances: tx.state.balances,
        shifts: tx.state.shifts,
      });
      const allRows = tx.state.sales
        .filter((sale) => {
          const shift = tx.state.shifts.find((row) => row.id === sale.shift_id);
          return !shift || shift.store_code === tillCode();
        })
        .map((sale, index) => ({ sale, index, cursor: `${sale.created_at}|${sale.id}` }))
        .sort((a, b) => a.sale.created_at.localeCompare(b.sale.created_at) || a.index - b.index);
      const rows = allRows.filter((row) => row.sale.status === "COMPLETED");
      const latest = rows.at(-1)?.cursor ?? "0";
      const cursor = since?.trim() || "";
      const cursorIndex = cursor ? allRows.findIndex((row) => row.cursor === cursor) : -1;
      const selected = !cursor
        ? []
        : cursorIndex >= 0
          ? allRows.slice(cursorIndex + 1).filter((row) => row.sale.status === "COMPLETED").slice(0, pageSize)
          : rows.filter((row) => row.cursor > cursor).slice(0, pageSize);
      const sales = selected.map(({ sale, index: saleIndex }) => {
        const staff = tx.state.staff.find((row) => row.staff_uid === sale.staff_uid);
        const ticket = sale.ticket_id ? tx.state.tickets.find((row) => row.id === sale.ticket_id) : undefined;
        const items = tx.state.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => {
          const product = tx.state.products.find((row) => row.sku === line.sku);
          return {
            sku: line.sku,
            name: product?.name ?? productName(tx.state, line.sku),
            size: sizeLabel(line.sku, product?.category, product?.name),
            qty: line.qty,
            line_price_cents: line.line_total_cents,
          };
        });
        return {
          id: sale.id,
          order_no: sale.ref_no,
          ticket_no: ticket?.code ?? null,
          at: sale.created_at,
          staff_name: staff?.display_name ?? "",
          items,
          total_cents: sale.total_cents,
          shift_order_number: allRows
            .filter((row) => row.sale.status === "COMPLETED" && row.sale.shift_id === sale.shift_id)
            .filter((row) => row.sale.created_at < sale.created_at || (row.sale.created_at === sale.created_at && row.index <= saleIndex))
            .length,
          shift_total_cents: allRows
            .filter((row) => row.sale.status === "COMPLETED" && row.sale.shift_id === sale.shift_id)
            .filter((row) => row.sale.created_at < sale.created_at || (row.sale.created_at === sale.created_at && row.index <= saleIndex))
            .reduce((sum, row) => sum + row.sale.total_cents, 0),
          payment: sale.payment_method === "DEBIT" ? "debit" as const : "cash" as const,
          store: tillCode(),
        };
      });
      const after = JSON.stringify({
        sales: tx.state.sales,
        lines: tx.state.sale_lines,
        balances: tx.state.balances,
        shifts: tx.state.shifts,
      });
      if (after !== before) throw new PosError(500, "FEED_WRITE", "The sales feed must not change the till.");
      return {
        ok: true as const,
        store: tillCode(),
        sales,
        next_cursor: selected.at(-1)?.cursor ?? (cursor || latest),
        bootstrap: !cursor,
      };
    });
  }

  /** Read the open shift's sales. Does not change stock, sales, counts, refills, or the PIN. */
  async shiftSummary(token: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, staff } = this.session(tx.state, token, now);
      const sales = tx.state.sales
        .filter((sale) => sale.shift_id === shift.id && sale.status === "COMPLETED")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((sale) => ({
          at: sale.created_at,
          payment: sale.payment_method,
          total_cents: sale.total_cents,
          lines: tx.state.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => ({
            sku: line.sku,
            name: productName(tx.state, line.sku),
            qty: line.qty,
            line_total_cents: line.line_total_cents,
          })),
        }));
      const deposits = tx.state.deposits
        .filter((deposit) => deposit.shift_id === shift.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((deposit) => ({ at: deposit.created_at, amount_cents: deposit.amount_cents, deposit_code: deposit.deposit_code ?? null }));
      const when = iso(now);
      return {
        ok: true as const,
        staff: staff.display_name,
        when,
        sales,
        deposits,
        text: summaryPlainText({ staff: staff.display_name, when, sales, deposits }),
      };
    });
  }

  async openTicket(token: string, ticketId: string, journal?: DemoJournalOrder[]) {
    return this.db.transaction(async (tx) => {
      absorbDemoJournal(tx.state, journal);
      const { shift, session } = this.session(tx.state, token, this.now());
      denyMaster(session);
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
      const { shift, session } = this.session(tx.state, token, this.now());
      denyMaster(session);
      const ticket = tx.state.tickets.find((row) => row.id === ticketId && row.shift_id === shift.id);
      if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
      if (ticket.status !== "PENDING" && ticket.status !== "OPEN") throw new PosError(409, "BAD_TICKET", "That ticket cannot be cancelled.");
      ticket.status = "CANCELLED";
      return { ok: true };
    });
  }

  async beginClose(token: string) {
    return this.db.transaction(async (tx) => {
      const { shift, session } = this.session(tx.state, token, this.now());
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status === "ACTIVE") shift.status = "CLOSING";
      if (shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      return { ok: true, status: shift.status, message: END_SHIFT_MESSAGE };
    });
  }

  /** Show the closing count. The shift stays open and selling continues. */
  async startClosingCount(token: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      const status = shift.status;
      const pin = shift.pin_hash;
      const draft = ensureDraft(tx.state, shift.id, now);
      if (!draft.closing_started_at) draft.closing_started_at = iso(now);
      draft.updated_at = iso(now);
      if (shift.status !== status || shift.pin_hash !== pin) throw new PosError(409, "SHIFT_UNCHANGED", "Starting the count must not change the open shift.");
      return { ok: true, status: shift.status, closing_started_at: draft.closing_started_at };
    });
  }

  async saveOpeningCount(token: string, input: { sku: string; counted_qty: number; variance_reason?: string }) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be counted.");
      lockUnverified(tx.state, shift, staff.staff_uid, now);
      if (verifyAnchorMs(shift) == null || now.getTime() >= (verifyAnchorMs(shift) as number) + VERIFY_WINDOW_MS) {
        throw new PosError(409, "VERIFY_CLOSED", "The verify window is closed. Uncleared SKUs are accepted as-is.");
      }
      const sku = input.sku.trim();
      const known = tx.state.products.some((row) => row.sku === sku) || tx.state.balances.some((row) => row.sku === sku);
      if (!known) throw new PosError(400, "BAD_SKU", "That SKU is not on this till.");
      if (!Number.isInteger(input.counted_qty) || input.counted_qty < 0) throw new PosError(400, "BAD_QTY", "Counted quantity must be a whole number.");
      const onHand = qtyOf(tx.state, sku);
      const draft = ensureDraft(tx.state, shift.id, now);
      if (draft.verify_submitted_at) throw new PosError(409, "VERIFY_CLOSED", "The verify count is already submitted.");
      const at = iso(now);
      const expected = expectedAtSubmit(tx.state, shift, sku, now.getTime());
      const next = {
        sku,
        counted_qty: input.counted_qty,
        expected_qty: expected,
        submitted_at: at,
        edited_at: at,
        variance_reason: null,
        added_stock: onHand === 0 && input.counted_qty > 0,
        accepted_as_is: false,
      };
      const existing = draft.opening_counts?.find((row) => row.sku === sku);
      if (existing) Object.assign(existing, next);
      else draft.opening_counts?.push(next);
      draft.updated_at = iso(now);
      audit(tx.state, "VERIFY_COUNT", "sku", sku, staff.staff_uid, { sku, added_stock: next.added_stock }, iso(now));
      const plan = verifySkuList(tx.state, shift.id);
      const cleared = plan.filter((item) => draft.opening_counts?.some((row) => row.sku === item)).length;
      return { ok: true, cleared, total: plan.length };
    });
  }

  /** Finish the verify count. Blank SKUs are accepted as-is. Entered drafts keep their last-edit expected. */
  async submitVerifyCount(token: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be counted.");
      const anchor = verifyAnchorMs(shift);
      if (anchor == null || now.getTime() >= anchor + VERIFY_WINDOW_MS) {
        throw new PosError(409, "VERIFY_CLOSED", "The verify window is closed. Uncleared SKUs are accepted as-is.");
      }
      finalizeVerify(tx.state, shift, staff.staff_uid, now);
      return { ok: true, verify_submitted_at: draftsOf(tx.state).find((row) => row.shift_id === shift.id)?.verify_submitted_at ?? null };
    });
  }

  /** Moving between SKUs does not accept the ones left blank. */
  async jumpOpeningCount(token: string, sku: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be counted.");
      lockUnverified(tx.state, shift, "staff", now);
      const anchor = verifyAnchorMs(shift);
      if (anchor == null || now.getTime() >= anchor + VERIFY_WINDOW_MS) {
        throw new PosError(409, "VERIFY_CLOSED", "The verify window is closed. Uncleared SKUs are accepted as-is.");
      }
      const target = sku.trim();
      if (!verifySkuList(tx.state, shift.id).includes(target)) throw new PosError(400, "BAD_SKU", "That SKU is not in this count.");
      return { ok: true, sku: target };
    });
  }

  private findOpenShift(state: State, shiftId: string) {
    const id = shiftId.trim();
    const shift = state.shifts.find((row) => row.sccx_shift_id === id || row.id === id);
    if (!shift || (shift.status !== "ACTIVE" && shift.status !== "CLOSING")) {
      throw new PosError(404, "NO_SHIFT", "That shift is not open.");
    }
    return shift;
  }

  /** Read the submitted verify and the on-hand behind it. Does not write. */
  async exportVerifyBackup(shiftId: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const shift = this.findOpenShift(tx.state, shiftId);
      const draft = draftsOf(tx.state).find((row) => row.shift_id === shift.id);
      const until = now.getTime();
      const anchor = verifyAnchorMs(shift);
      const stock = verifySkuList(tx.state, shift.id).map((sku) => {
        const previous = previousCloseLeft(tx.state, shift, sku);
        const refills = refillsUntil(tx.state, shift.id, sku, until);
        const sales = salesUntil(tx.state, shift.id, sku, until);
        const on_hand = qtyOf(tx.state, sku);
        const pre_count = previous != null ? previous + refills - sales : on_hand;
        return { sku, on_hand, previous_close_left: previous, refills, sales, pre_count, delta: on_hand - pre_count };
      });
      return {
        ok: true as const,
        exported_at: iso(now),
        shift_id: shift.sccx_shift_id,
        shift_status: shift.status,
        verify_opened_at: shift.verify_opened_at ?? null,
        verify_release: shift.verify_release ?? null,
        deadline_at: anchor == null ? null : new Date(anchor + VERIFY_WINDOW_MS).toISOString(),
        verify_submitted_at: draft?.verify_submitted_at ?? null,
        opening_counts: draft?.opening_counts ?? [],
        stock,
      };
    });
  }

  /**
   * Drop this shift's opening verify and put on-hand back to yesterday's close plus refills minus sales.
   * Sales, the PIN, refills, deposits, and the verify clock stay.
   */
  async undoOpeningVerify(shiftId: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      const shift = this.findOpenShift(tx.state, shiftId);
      const pin = shift.pin_hash;
      const status = shift.status;
      const started = shift.started_at;
      const opened = shift.verify_opened_at;
      const release = shift.verify_release;
      const sales = JSON.stringify(tx.state.sales);
      const incoming = JSON.stringify(tx.state.incoming);
      const deposits = JSON.stringify(tx.state.deposits);
      const until = now.getTime();
      const stock_changes: { sku: string; from: number; to: number }[] = [];
      for (const sku of verifySkuList(tx.state, shift.id)) {
        const previous = previousCloseLeft(tx.state, shift, sku);
        if (previous == null) continue;
        const target = previous + refillsUntil(tx.state, shift.id, sku, until) - salesUntil(tx.state, shift.id, sku, until);
        const row = tx.state.balances.find((item) => item.sku === sku);
        const current = row?.qty ?? 0;
        if (current === target) continue;
        if (row) {
          row.qty = target;
          row.updated_at = at;
        } else if (target !== 0) {
          tx.state.balances.push({ sku, qty: target, updated_at: at, created_at: at });
        }
        stock_changes.push({ sku, from: current, to: target });
      }
      const draft = draftsOf(tx.state).find((row) => row.shift_id === shift.id);
      const removed = draft?.opening_counts?.length ?? 0;
      if (draft) {
        draft.opening_counts = [];
        draft.verify_submitted_at = null;
        draft.updated_at = at;
      }
      if (
        shift.pin_hash !== pin
        || shift.status !== status
        || shift.started_at !== started
        || shift.verify_opened_at !== opened
        || shift.verify_release !== release
        || JSON.stringify(tx.state.sales) !== sales
        || JSON.stringify(tx.state.incoming) !== incoming
        || JSON.stringify(tx.state.deposits) !== deposits
      ) {
        throw new PosError(409, "SHIFT_UNCHANGED", "The verify undo would have changed sales, refills, deposits, or the shift.");
      }
      const anchor = verifyAnchorMs(shift);
      return {
        ok: true as const,
        shift_id: shift.sccx_shift_id,
        status: shift.status,
        removed_counts: removed,
        stock_changes,
        verify_opened_at: shift.verify_opened_at ?? null,
        deadline_at: anchor == null ? null : new Date(anchor + VERIFY_WINDOW_MS).toISOString(),
      };
    });
  }

  /** Read every sale on the shift. Does not write. */
  async listShiftSales(shiftId: string) {
    return this.db.transaction(async (tx) => {
      const shift = this.findOpenShift(tx.state, shiftId);
      const totals = shiftTotals(tx.state, shift.id);
      const sales = tx.state.sales
        .filter((sale) => sale.shift_id === shift.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .map((sale) => describeShiftSale(tx.state, sale));
      return {
        ok: true as const,
        shift_id: shift.sccx_shift_id,
        status: shift.status,
        sales_total_cents: totals.sales_total_cents,
        cash_on_hand_cents: totals.cash_on_hand_cents,
        sales,
      };
    });
  }

  /**
   * Void the only completed sale on the shift and put its stock back.
   * Refuses when the shift does not have exactly one sale.
   * Does not change the shift, PIN, counts, deposits, or refills.
   */
  async voidOnlyShiftSale(shiftId: string, reason: string) {
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      const shift = this.findOpenShift(tx.state, shiftId);
      const sales = tx.state.sales.filter((sale) => sale.shift_id === shift.id);
      if (sales.length !== 1) {
        return { ok: false as const, status: 409, code: "MANY_SALES", message: "This shift does not have exactly one sale.", count: sales.length };
      }
      const sale = sales[0];
      if (!sale || sale.status !== "COMPLETED") {
        return { ok: false as const, status: 409, code: "VOID_FINAL", message: "That sale is already voided.", count: sales.length };
      }
      if (!reason.trim()) throw new PosError(400, "REASON_REQUIRED", "A void needs a reason.");
      const pin = shift.pin_hash;
      const status = shift.status;
      const started = shift.started_at;
      const opened = shift.verify_opened_at;
      const counts = JSON.stringify(tx.state.closing_drafts ?? []);
      const deposits = JSON.stringify(tx.state.deposits);
      const incoming = JSON.stringify(tx.state.incoming);
      const backup = describeShiftSale(tx.state, sale);
      const stock_before = backup.items.map((item) => ({ sku: item.sku, qty: qtyOf(tx.state, item.sku) }));
      sale.status = "VOIDED";
      sale.void_reason = reason.trim();
      sale.voided_by = "admin";
      for (const line of tx.state.sale_lines.filter((row) => row.sale_id === sale.id)) {
        const next = balanceAdd(tx.state, line.sku, line.qty, at, true);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not restore stock.");
        ledger(tx.state, line.sku, line.qty, "VOID", "sale", sale.id, "admin", reason.trim(), sale.shift_id, at);
      }
      const payload = salePayload(tx.state, sale.id);
      if (payload) enqueue(tx.state, "S_Sales", payload.row_id, payload, at);
      if (
        shift.pin_hash !== pin
        || shift.status !== status
        || shift.started_at !== started
        || shift.verify_opened_at !== opened
        || JSON.stringify(tx.state.closing_drafts ?? []) !== counts
        || JSON.stringify(tx.state.deposits) !== deposits
        || JSON.stringify(tx.state.incoming) !== incoming
      ) {
        throw new PosError(409, "SHIFT_UNCHANGED", "The void would have changed the shift, counts, deposits, or refills.");
      }
      const totals = shiftTotals(tx.state, shift.id);
      return {
        ok: true as const,
        sale: backup,
        stock_before,
        stock_after: backup.items.map((item) => ({ sku: item.sku, qty: qtyOf(tx.state, item.sku) })),
        sales_total_cents: totals.sales_total_cents,
        cash_on_hand_cents: totals.cash_on_hand_cents,
        feed_cursor: backup.cursor,
      };
    });
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    this.bumpMenu();
    return result;
  }

  /**
   * The first sale is 10 red Goose Full (1011) and 10 blue Goose Lights (1012), and nothing else.
   * Returns that sale without writing. A different cart is not a match.
   */
  async exportGooseCartonSale(shiftId: string) {
    return this.db.transaction(async (tx) => {
      const shift = this.findOpenShift(tx.state, shiftId);
      const sale = gooseCartonSale(tx.state, shift.id);
      if (!sale) return { ok: false as const, status: 409, code: "NO_MATCH", message: "No sale is exactly 10 Goose Red and 10 Goose Blue." };
      const totals = shiftTotals(tx.state, shift.id);
      return {
        ok: true as const,
        shift_id: shift.sccx_shift_id,
        sale: describeShiftSale(tx.state, sale),
        stock: ["1011", "1012"].map((sku) => ({ sku, qty: qtyOf(tx.state, sku) })),
        sales_total_cents: totals.sales_total_cents,
        cash_on_hand_cents: totals.cash_on_hand_cents,
        deposited_cents: totals.deposited_cents,
      };
    });
  }

  /** Void only that Goose carton sale. Other sales, deposits, and the shift stay. */
  async voidGooseCartonSale(shiftId: string, reason: string) {
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const at = iso(now);
      const shift = this.findOpenShift(tx.state, shiftId);
      const sale = gooseCartonSale(tx.state, shift.id);
      if (!sale) return { ok: false as const, status: 409, code: "NO_MATCH", message: "No sale is exactly 10 Goose Red and 10 Goose Blue." };
      if (!reason.trim()) throw new PosError(400, "REASON_REQUIRED", "A void needs a reason.");
      const totals = shiftTotals(tx.state, shift.id);
      const cashAfter = totals.cash_sales_cents - (sale.payment_method === "DEBIT" ? 0 : sale.total_cents);
      if (depositAboveCash(totals.deposited_cents, cashAfter)) {
        return { ok: false as const, status: 409, code: "DEPOSIT_ABOVE", message: "Voiding this cash sale would put deposits above cash on hand.", deposited_cents: totals.deposited_cents, cash_after_cents: cashAfter };
      }
      const pin = shift.pin_hash;
      const status = shift.status;
      const started = shift.started_at;
      const opened = shift.verify_opened_at;
      const counts = JSON.stringify(tx.state.closing_drafts ?? []);
      const deposits = JSON.stringify(tx.state.deposits);
      const incoming = JSON.stringify(tx.state.incoming);
      const otherIds = tx.state.sales.filter((row) => row.shift_id === shift.id && row.id !== sale.id).map((row) => ({ id: row.id, status: row.status }));
      const backup = describeShiftSale(tx.state, sale);
      const stock_before = backup.items.map((item) => ({ sku: item.sku, qty: qtyOf(tx.state, item.sku) }));
      sale.status = "VOIDED";
      sale.void_reason = reason.trim();
      sale.voided_by = "admin";
      for (const line of tx.state.sale_lines.filter((row) => row.sale_id === sale.id)) {
        const next = balanceAdd(tx.state, line.sku, line.qty, at, true);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not restore stock.");
        ledger(tx.state, line.sku, line.qty, "VOID", "sale", sale.id, "admin", reason.trim(), sale.shift_id, at);
      }
      const payload = salePayload(tx.state, sale.id);
      if (payload) enqueue(tx.state, "S_Sales", payload.row_id, payload, at);
      const othersMoved = tx.state.sales.some((row) => {
        const prior = otherIds.find((item) => item.id === row.id);
        return prior != null && prior.status !== row.status;
      });
      if (othersMoved) throw new PosError(409, "SHIFT_UNCHANGED", "The void changed another sale.");
      if (
        shift.pin_hash !== pin
        || shift.status !== status
        || shift.started_at !== started
        || shift.verify_opened_at !== opened
        || JSON.stringify(tx.state.closing_drafts ?? []) !== counts
        || JSON.stringify(tx.state.deposits) !== deposits
        || JSON.stringify(tx.state.incoming) !== incoming
      ) {
        throw new PosError(409, "SHIFT_UNCHANGED", "The void would have changed the shift, counts, deposits, or refills.");
      }
      const after = shiftTotals(tx.state, shift.id);
      return {
        ok: true as const,
        sale: backup,
        stock_before,
        stock_after: backup.items.map((item) => ({ sku: item.sku, qty: qtyOf(tx.state, item.sku) })),
        sales_total_cents: after.sales_total_cents,
        cash_on_hand_cents: after.cash_on_hand_cents,
        deposited_cents: after.deposited_cents,
      };
    });
    if (!result.ok) throw new PosError(result.status, result.code, result.message);
    this.bumpMenu();
    return result;
  }

  /** Move only the verify clock. Counts, stock, sales, refills, PIN, and shift status stay. */
  async restartVerifyDeadline(shiftId: string) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const id = shiftId.trim();
      const shift = tx.state.shifts.find((row) => row.sccx_shift_id === id || row.id === id);
      if (!shift || (shift.status !== "ACTIVE" && shift.status !== "CLOSING")) {
        throw new PosError(404, "NO_SHIFT", "That shift is not open.");
      }
      const pin = shift.pin_hash;
      const status = shift.status;
      const started = shift.started_at;
      const release = shift.verify_release;
      const counts = JSON.stringify(tx.state.closing_drafts ?? []);
      const sales = JSON.stringify(tx.state.sales);
      const balances = JSON.stringify(tx.state.balances);
      const incoming = JSON.stringify(tx.state.incoming);
      shift.verify_opened_at = iso(now);
      if (
        shift.pin_hash !== pin
        || shift.status !== status
        || shift.started_at !== started
        || shift.verify_release !== release
        || JSON.stringify(tx.state.closing_drafts ?? []) !== counts
        || JSON.stringify(tx.state.sales) !== sales
        || JSON.stringify(tx.state.balances) !== balances
        || JSON.stringify(tx.state.incoming) !== incoming
      ) {
        throw new PosError(409, "SHIFT_UNCHANGED", "The deadline reset would have changed more than the clock.");
      }
      return {
        ok: true,
        shift_id: shift.sccx_shift_id,
        status: shift.status,
        verify_opened_at: shift.verify_opened_at,
        deadline_at: new Date(now.getTime() + VERIFY_WINDOW_MS).toISOString(),
      };
    });
  }

  async absorbForDemo(journal?: DemoJournalOrder[]) {
    if (!this.deps.demo || !journal?.length) return;
    await this.db.transaction(async (tx) => {
      absorbDemoJournal(tx.state, journal);
    });
  }

  async restoreDemoDrafts(drafts: DemoDraft[]) {
    if (!this.deps.demo || drafts.length === 0) return;
    await this.db.transaction(async (tx) => {
      const rows = draftsOf(tx.state);
      for (const draft of drafts) {
        const existing = rows.find((row) => row.shift_id === draft.shift_id);
        if (existing) {
          existing.counts = draft.counts ?? [];
          existing.opening_counts = draft.opening_counts ?? [];
          existing.closing_started_at = draft.closing_started_at ?? null;
          existing.closing_submitted_at = draft.closing_submitted_at ?? null;
          existing.final_deposit_cents = draft.final_deposit_cents ?? null;
          existing.final_deposit_code = draft.final_deposit_code ?? null;
          existing.updated_at = draft.updated_at || existing.updated_at;
        } else {
          rows.push({
            shift_id: draft.shift_id,
            counts: draft.counts ?? [],
            opening_counts: draft.opening_counts ?? [],
            closing_started_at: draft.closing_started_at ?? null,
            closing_submitted_at: draft.closing_submitted_at ?? null,
            final_deposit_cents: draft.final_deposit_cents ?? null,
            final_deposit_code: draft.final_deposit_code ?? null,
            updated_at: draft.updated_at || iso(this.now()),
          });
        }
      }
    });
  }

  async exportDemoDrafts(): Promise<DemoDraft[]> {
    if (!this.deps.demo) return [];
    return this.db.transaction(async (tx) => draftsOf(tx.state).map((row) => ({
      shift_id: row.shift_id,
      counts: row.counts ?? [],
      opening_counts: row.opening_counts ?? [],
      closing_started_at: row.closing_started_at ?? null,
      closing_submitted_at: row.closing_submitted_at ?? null,
      final_deposit_cents: row.final_deposit_cents,
      final_deposit_code: row.final_deposit_code ?? null,
      updated_at: row.updated_at,
    })));
  }

  async saveClosingCount(token: string, input: { sku: string; counted_qty: number }) {
    return this.db.transaction(async (tx) => {
      const { shift, session } = this.session(tx.state, token, this.now());
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      const plan = shiftClosePlan(tx.state, shift.id);
      if (!plan.some((line) => line.sku === input.sku)) throw new PosError(400, "BAD_SKU", "That SKU is not in this close.");
      if (!Number.isInteger(input.counted_qty) || input.counted_qty < 0) throw new PosError(400, "BAD_QTY", "Counted quantity must be a whole number.");
      const drafts = draftsOf(tx.state);
      let draft = drafts.find((row) => row.shift_id === shift.id);
      if (!draft) {
        draft = { shift_id: shift.id, counts: [], final_deposit_cents: null, updated_at: iso(this.now()) };
        drafts.push(draft);
      }
      if (draft.closing_submitted_at) throw new PosError(409, "COUNT_CLOSED", "The closing count is already submitted.");
      const at = iso(this.now());
      const expected = expectedAtSubmit(tx.state, shift, input.sku, this.now().getTime());
      const existing = draft.counts.find((row) => row.sku === input.sku);
      if (existing) {
        existing.counted_qty = input.counted_qty;
        existing.edited_at = at;
        existing.expected_qty = expected;
        existing.accepted_as_is = false;
      } else draft.counts.push({ sku: input.sku, counted_qty: input.counted_qty, edited_at: at, expected_qty: expected, accepted_as_is: false });
      draft.updated_at = iso(this.now());
      const done = plan.filter((line) => draft.counts.some((row) => row.sku === line.sku)).length;
      return { ok: true, done, total: plan.length };
    });
  }

  /** Finish the closing count. Every SKU must be typed; an explicit confirmation records every blank as zero. */
  async submitClosingCount(token: string, input: { confirm_blanks_zero?: boolean } = {}) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      const draft = ensureDraft(tx.state, shift.id, now);
      if (draft.closing_submitted_at) return { ok: true, closing_submitted_at: draft.closing_submitted_at };
      const at = iso(now);
      if (!draft.closing_started_at) draft.closing_started_at = at;
      const plan = shiftClosePlan(tx.state, shift.id);
      const blankSkus = plan
        .filter((line) => {
          const saved = draft.counts.find((row) => row.sku === line.sku);
          return !saved || saved.accepted_as_is;
        })
        .map((line) => line.sku);
      if (blankSkus.length && !input.confirm_blanks_zero) {
        throw new PosError(
          409,
          "COUNT_INCOMPLETE",
          `${blankSkus.length} items were not counted. Go back and count, or confirm as 0.`,
          { blank_skus: blankSkus },
        );
      }
      for (const sku of blankSkus) {
        const expected = expectedAtSubmit(tx.state, shift, sku, now.getTime());
        const saved = draft.counts.find((row) => row.sku === sku);
        if (saved) {
          saved.counted_qty = 0;
          saved.edited_at = at;
          saved.expected_qty = expected;
          saved.accepted_as_is = false;
        } else {
          draft.counts.push({ sku, counted_qty: 0, edited_at: at, expected_qty: expected, accepted_as_is: false });
        }
      }
      draft.closing_submitted_at = at;
      draft.updated_at = at;
      return { ok: true, closing_submitted_at: at, recorded_as_zero: blankSkus };
    });
  }

  async saveOpeningFloat(token: string, input: { found_cents: number }) {
    return this.db.transaction(async (tx) => {
      const { shift, session } = this.session(tx.state, token, this.now());
      denyMaster(session);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot check the float.");
      const found = roundCents(input.found_cents);
      if (!Number.isFinite(found) || found < 0) throw new PosError(400, "BAD_AMOUNT", "Enter the cash left in the till.");
      const previous = previousClosing(tx.state, shift);
      if (!previous) throw new PosError(409, "NO_FLOAT", "There is no previous close to check.");
      const expected = previous.float_cents ?? 0;
      const draft = ensureDraft(tx.state, shift.id, this.now());
      draft.float_found_cents = found;
      draft.float_expected_cents = expected;
      draft.updated_at = iso(this.now());
      return { ok: true, expected_cents: expected, found_cents: found, gap_cents: found - expected };
    });
  }

  async saveFinalDeposit(token: string, input: { amount_cents: number; float_cents?: number }) {
    return this.db.transaction(async (tx) => {
      const { shift, session } = this.session(tx.state, token, this.now());
      denyMaster(session);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      const amount = roundCents(input.amount_cents);
      if (!Number.isFinite(amount) || amount < 0) throw new PosError(400, "BAD_AMOUNT", "Enter the final deposit.");
      const totals = shiftTotals(tx.state, shift.id);
      const drafts = draftsOf(tx.state);
      let draft = drafts.find((row) => row.shift_id === shift.id);
      if (!draft) {
        draft = { shift_id: shift.id, counts: [], final_deposit_cents: amount, updated_at: iso(this.now()) };
        drafts.push(draft);
      }
      draft.final_deposit_cents = amount;
      if (input.float_cents != null) {
        const floatCents = roundCents(input.float_cents);
        if (!Number.isFinite(floatCents) || floatCents < 0) throw new PosError(400, "BAD_AMOUNT", "Enter the float left in the till.");
        draft.float_cents = floatCents;
      }
      if (amount > 0) {
        draft.final_deposit_code = draft.final_deposit_code || issueDepositCode(tx.state);
      } else if (draft.final_deposit_code) {
        const issued = draft.final_deposit_code;
        draft.final_deposit_code = null;
        releaseTailDepositCode(tx.state, issued);
      }
      draft.updated_at = iso(this.now());
      return { ok: true, final_deposit_cents: amount, float_cents: draft.float_cents ?? 0, deposit_code: draft.final_deposit_code ?? null, cash_on_hand_cents: totals.cash_on_hand_cents };
    });
  }

  async endShiftFromPos(token: string, input: { key: string; lines: { sku: string; counted_qty: number; variance_reason?: string }[]; final_deposit_cents?: number; float_cents?: number }) {
    const body = input as unknown as Json;
    const raw = await this.rawUnitPrices();
    const knownLabels = await this.deps.sheet.readStockLabels?.().catch(() => [] as StockLabelRow[]) ?? [];
    return this.db.transaction(async (tx) => {
      adoptStockLabels(tx.state, knownLabels);
      const now = this.now();
      const seen = replay(tx.state, "pos_end", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const { shift, staff, session } = this.session(tx.state, token, now);
      denyMaster(session);
      requireWeedAnswer(shift);
      if (shift.status !== "ACTIVE" && shift.status !== "CLOSING") throw new PosError(409, "SHIFT_NOT_ACTIVE", "This shift cannot be closed.");
      const plan = shiftClosePlan(tx.state, shift.id, raw);
      const bySku = new Map(input.lines.map((line) => [line.sku, line]));
      const draft = draftsOf(tx.state).find((row) => row.shift_id === shift.id);
      if (!draft?.closing_submitted_at) {
        throw new PosError(409, "COUNT_REQUIRED", "Submit the closing stock count before ending the shift.");
      }
      const finalDeposit = roundCents(input.final_deposit_cents ?? 0);
      if (!Number.isFinite(finalDeposit) || finalDeposit < 0) throw new PosError(400, "BAD_AMOUNT", "Enter the final deposit.");
      const floatCents = roundCents(input.float_cents ?? draft?.float_cents ?? 0);
      if (!Number.isFinite(floatCents) || floatCents < 0) throw new PosError(400, "BAD_AMOUNT", "Enter the float left in the till.");
      const at = iso(now);
      if (finalDeposit > 0) {
        const reserved = draftsOf(tx.state).find((row) => row.shift_id === shift.id)?.final_deposit_code;
        const deposit_code = reserved || issueDepositCode(tx.state);
        const deposit = { id: randomUUID(), shift_id: shift.id, staff_uid: staff.staff_uid, amount_cents: finalDeposit, note: "final deposit", deposit_code, created_at: at };
        tx.state.deposits.push(deposit);
        enqueue(tx.state, "S_Deposits", `D-${deposit.id}`, {
          row_id: `D-${deposit.id}`,
          deposit_id: deposit.id,
          deposit_code,
          store_code: tillCode(),
          shift_id: shift.sccx_shift_id,
          staff_pos_id: staff.pos_id,
          amount: centsToSheet(deposit.amount_cents),
          note: deposit.note ?? "",
          at,
        }, at);
      }
      const countId = randomUUID();
      const closingLines: ClosingLine[] = [];
      for (const item of plan) {
        const saved = draft?.counts.find((row) => row.sku === item.sku);
        const editedAt = saved && !saved.accepted_as_is && saved.edited_at ? Date.parse(saved.edited_at) : NaN;
        if (!saved || saved.accepted_as_is || !Number.isFinite(editedAt)) {
          throw new PosError(409, "COUNT_REQUIRED", "Every SKU must be counted before ending the shift.");
        }
        const after = salesAfter(tx.state, shift.id, item.sku, editedAt);
        const expected = (saved.expected_qty ?? expectedAtSubmit(tx.state, shift, item.sku, editedAt)) - after;
        const counted = saved.counted_qty - after;
        if (!Number.isInteger(counted) || counted < 0 || !Number.isInteger(expected)) throw new PosError(400, "BAD_QTY", "Counted quantity must be a whole number.");
        const variance = lineVariance({ expected_qty: expected, counted_qty: counted, price_cents: item.price_cents });
        closingLines.push({
          sku: item.sku,
          name: item.name,
          left: counted,
          system_qty: qtyOf(tx.state, item.sku),
          price_cents: item.price_cents,
          opening_qty: item.opening_qty,
          received_qty: item.received_qty,
          sold_qty: item.sold_qty,
          expected_qty: expected,
          variance_qty: variance.variance_qty,
          shortage_cents: variance.shortage_cents,
          overage_cents: variance.overage_cents,
        });
      }
      tx.state.counts.push({ id: countId, shift_id: shift.id, kind: "CLOSING", confirmed_at: at, created_at: at });
      for (const line of closingLines) {
        const delta = line.left - line.system_qty;
        const reason = bySku.get(line.sku)?.variance_reason?.trim() || null;
        tx.state.count_lines.push({
          id: randomUUID(),
          count_id: countId,
          sku: line.sku,
          system_qty: line.system_qty,
          counted_qty: line.left,
          variance_reason: reason,
        });
        if (delta !== 0) {
          const next = balanceAdd(tx.state, line.sku, delta, at, true);
          if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Count would take stock below zero.");
          ledger(tx.state, line.sku, delta, "COUNT_VARIANCE", "stock_count", countId, staff.staff_uid, reason, shift.id, at);
        }
      }
      expireTickets(tx.state, now.getTime(), shift.id);
      const closing = buildClosing(tx.state, shift, closingLines, false, at, finalDeposit, floatCents);
      finishShift(tx.state, shift, "POS_END", at, closing);
      const saved = tx.state.closings.find((row) => row.shift_id === shift.id) ?? closing;
      queueClosingSheets(tx.state, shift, saved, at);
      const result = { ok: true, message: END_SHIFT_MESSAGE, no_count: false, summary_text: saved.summary_text, close_label: saved.close_label ?? null, closing: saved };
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
    const readTab = async (tab: string) => {
      try {
        return await this.deps.sheet.readRows(tab);
      } catch (error) {
        if (error instanceof SheetUnavailable && error.httpStatus === 400) return [] as SheetRow[];
        throw error;
      }
    };
    let rows: SheetRow[] = [];
    try {
      const [legacy, refills] = await Promise.all([readTab("K_Allocations"), readTab("POS_Refills")]);
      rows = [
        ...legacy,
        ...refills.filter((row) => row.record_type !== "POS" && row.record_type !== "STATE" && row.record_type !== "STATE_RETIRED"),
      ];
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
        if ((row.store_code ?? "").trim() !== tillCode()) continue;
        const problem = this.kitchenProblem(state, row);
        if (problem) {
          const badId = row.row_id && isUuid(row.row_id) ? `R-${row.row_id}` : `R-BAD-${sheetRow}`;
          enqueue(state, "S_Receipts", badId, {
            row_id: badId,
            kitchen_row_id: row.row_id ?? "",
            store_code: tillCode(),
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
            store_code: tillCode(),
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
    if (this.menuCache && this.menuCache.store === tillCode() && this.menuCache.gen === this.menuGen && nowMs - this.menuCache.at < MENU_CACHE_MS) return this.menuCache.body;
    const [raw, flowers, itemCatalog, masters] = await Promise.all([this.rawUnitPrices(), this.flowerIndex(), this.itemIndex(), this.sheetMasters()]);
    const notes = await this.rawCartonNotes();
    const body = await this.db.transaction(async (tx) => {
      const now = iso(this.now());
      if (tillCode() === "PNY02" && this.db instanceof SheetDb) await this.db.pullPny2Stock(tx.state);
      this.ensurePny2(tx.state, now);
      const shift = tx.state.shifts.find((row) => row.store_code === tillCode() && row.status === "ACTIVE");
      if (shift) {
        nameLiveShift(tx.state, now);
        openTillWithoutCount(shift, now);
      }
      const open = shift && shift.opening_confirmed_at && sellingBlocked(tx.state, shift) == null;
      const items = tx.state.products
        .filter((product) => product.setb_active)
        .flatMap((product) => {
          const storeProduct = tx.state.store_products.find((item) => item.store_code === tillCode() && item.sku === product.sku);
          if (!storeProduct?.enabled || qtyOf(tx.state, product.sku) <= 0) return [];
          const pack = cigarettePackCents(product.sku, product.category, product.name);
          const cents = pack ?? raw.get(product.sku) ?? storeProduct.price_override_cents ?? product.default_price_cents;
          if (cents <= 0) return [];
          const carton = notes.get(product.sku);
          const item = presentCatalogItem({
            sku: product.sku,
            name: product.name,
            category: product.category,
            price_cents: cents,
            image_url: product.image_url,
          }, flowers, itemCatalog);
          if (item.price_cents <= 0) return [];
          return [{
            ...item,
            availability: "Available" as const,
            ...(pack != null ? { unit_label: "per pack" } : {}),
            ...(carton ? { carton_note: carton } : {}),
          }];
        })
        .sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
      const seen = new Set(items.map((item) => item.sku));
      for (const extra of [...stockedCatalogRows(tx.state, itemCatalog), ...stockedMasterRows(tx.state, masters, flowers, itemCatalog)]) {
        if (seen.has(extra.sku) || extra.qty <= 0) continue;
        seen.add(extra.sku);
        const carton = notes.get(extra.sku);
        items.push({
          sku: extra.sku,
          name: extra.name,
          category: extra.category,
          price_cents: extra.price_cents,
          image_url: extra.image_url,
          availability: "Available" as const,
          ...("flower_type" in extra && extra.flower_type ? { flower_type: extra.flower_type } : {}),
          ...("thc" in extra && extra.thc ? { thc: extra.thc } : {}),
          ...(carton ? { carton_note: carton } : {}),
        });
      }
      return {
        ok: true,
        store: tillCode(),
        demo: Boolean(this.deps.demo),
        demo_label: this.deps.demo ? DEMO_LABEL : null,
        ordering: Boolean(open),
        prices_include_tax: false,
        items,
      };
    });
    this.menuCache = { gen: this.menuGen, at: nowMs, store: tillCode(), body };
    return body;
  }

  async placeOrder(input: { key: string; lines: { sku: string; qty: number }[] }, ip: string, journal?: DemoJournalOrder[]) {
    this.hit(`order:${ip || "unknown"}`, 10, 60 * 1000);
    const body = input as unknown as Json;
    const [raw, flowers, items, masters] = await Promise.all([this.rawUnitPrices(), this.flowerIndex(), this.itemIndex(), this.sheetMasters()]);
    return this.db.transaction(async (tx) => {
      const now = this.now();
      absorbDemoJournal(tx.state, journal);
      const seen = replay(tx.state, "menu_order", input.key, body, now, this.deps.secrets.session);
      if (seen) return seen;
      const shift = tx.state.shifts.find((row) => row.store_code === tillCode() && row.status === "ACTIVE");
      if (!shift?.opening_confirmed_at || sellingBlocked(tx.state, shift)) throw new PosError(409, "ORDERING_CLOSED", "Ordering is unavailable right now.");
      const pending = tx.state.tickets.filter((ticket) => ticket.shift_id === shift.id && ticket.status === "PENDING").length;
      if (pending >= MAX_PENDING_TICKETS) throw new PosError(429, "TICKET_LIMIT", "The till queue is full. Please see staff.");
      const lines = mergeLines(input.lines);
      for (const line of lines) {
        try {
          priceOf(tx.state, line.sku, raw, flowers, items, masters);
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
        const price = priceOf(tx.state, line.sku, raw, flowers, items, masters);
        total += price.cents * line.qty;
        tx.state.ticket_lines.push({ id: randomUUID(), ticket_id: ticketId, sku: line.sku, qty: line.qty, unit_price_cents_snapshot: price.cents });
      }
      const result = {
        ok: true,
        code,
        expires_at: iso(new Date(now.getTime() + TICKET_TTL_MS)),
        total_cents: total,
        prices_include_tax: false,
        journal_order: journalFromTicket(tx.state, ticketId),
      };
      remember(tx.state, "menu_order", input.key, body, result, now, this.deps.secrets.session);
      return result;
    });
  }

  async ticketStatus(code: string, journal?: DemoJournalOrder[]) {
    return this.db.transaction(async (tx) => {
      const now = this.now();
      absorbDemoJournal(tx.state, journal);
      expireTickets(tx.state, now.getTime());
      const ticket = tx.state.tickets
        .filter((row) => row.code.toUpperCase() === code.toUpperCase())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!ticket) throw new PosError(404, "TICKET", "Ticket was not found.");
      const lines = tx.state.ticket_lines.filter((line) => line.ticket_id === ticket.id);
      const paid = ticket.status === "CASHED_OUT";
      return {
        ok: true,
        code: ticket.code,
        status: paid ? "PAID" : ticket.status,
        paid,
        closed: paid || ticket.status === "CANCELLED" || ticket.status === "EXPIRED",
        expires_at: ticket.expires_at,
        prices_include_tax: false,
        total_cents: lines.reduce((sum, line) => sum + line.qty * line.unit_price_cents_snapshot, 0),
        journal_order: journalFromTicket(tx.state, ticket.id),
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
          const closing = buildClosing(tx.state, shift, noCountLines(tx.state, shift), true, at);
          finishShift(tx.state, shift, "EXPIRED", at, closing);
        }
      }
      return { ok: true, expired };
    });
  }

  /** Read-only closings for the current store. Does not increment SCCx attempts. */
  async readClosings() {
    return this.db.transaction(async (tx) => {
      const code = tillCode();
      const closings = tx.state.closings.flatMap((closing) => {
        const shift = tx.state.shifts.find((row) => row.id === closing.shift_id);
        if (!shift || shift.store_code !== code) return [];
        const staff = tx.state.staff.find((row) => row.staff_uid === shift.staff_uid);
        return [{
          shift_id: shift.sccx_shift_id,
          store: code,
          staff_pos_id: staff?.pos_id ?? "",
          ended_at: shift.ended_at,
          sales_total: closing.sales_total_cents,
          cash_sales: closing.cash_sales_cents ?? closing.sales_total_cents,
          debit_sales: closing.debit_sales_cents ?? 0,
          sale_count: closing.sale_count,
          voids: closing.void_count,
          cash_on_hand: closing.cash_on_hand_cents,
          deposited: closing.deposited_cents,
          final_deposit: closing.final_deposit_cents ?? 0,
          shortage: closing.shortage_cents ?? 0,
          overage: closing.overage_cents ?? 0,
          balance: closing.balance_cents ?? 0,
          no_count: closing.no_count,
          money_unit: "cents",
          summary_text: closing.summary_text,
          close_label: closing.close_label ?? null,
        }];
      });
      return { ok: true as const, store: code, closings };
    });
  }

  async closedShifts() {
    return this.db.transaction(async (tx) => {
      const rows = tx.state.closings.filter((closing) => {
        if (closing.sccx_ack_at) return false;
        const shift = tx.state.shifts.find((row) => row.id === closing.shift_id);
        return !shift || shift.store_code === "PNY01";
      });
      for (const closing of rows) closing.sccx_attempts += 1;
      const closings = rows.map((closing) => {
        const shift = tx.state.shifts.find((row) => row.id === closing.shift_id);
        const staff = tx.state.staff.find((row) => row.staff_uid === shift?.staff_uid);
        return {
          shift_id: shift?.sccx_shift_id ?? closing.shift_id,
          staff_pos_id: staff?.pos_id ?? "",
          ended_at: shift?.ended_at,
          sales_total: closing.sales_total_cents,
          cash_sales: closing.cash_sales_cents ?? closing.sales_total_cents,
          debit_sales: closing.debit_sales_cents ?? 0,
          sale_count: closing.sale_count,
          voids: closing.void_count,
          cash_on_hand: closing.cash_on_hand_cents,
          deposited: closing.deposited_cents,
          final_deposit: closing.final_deposit_cents ?? 0,
          shortage: closing.shortage_cents ?? 0,
          overage: closing.overage_cents ?? 0,
          balance: closing.balance_cents ?? 0,
          tickets: { total: closing.tickets_total, cashed: closing.tickets_cashed_out, expired: closing.tickets_expired },
          left: closing.closing_lines.map((line) => ({ sku: line.sku, name: line.name, qty: line.left })),
          variance: closing.closing_lines.map((line) => ({
            sku: line.sku,
            name: line.name,
            price_cents: line.price_cents ?? 0,
            opening_qty: line.opening_qty ?? 0,
            received_qty: line.received_qty ?? 0,
            sold_qty: line.sold_qty ?? 0,
            expected_qty: line.expected_qty ?? line.system_qty,
            counted_qty: line.left,
            variance_qty: line.variance_qty ?? line.left - (line.expected_qty ?? line.system_qty),
            shortage_cents: line.shortage_cents ?? 0,
            overage_cents: line.overage_cents ?? 0,
          })),
          no_count: closing.no_count,
          money_unit: "cents",
          summary_text: closing.summary_text,
          close_label: closing.close_label ?? null,
        };
      });
      return { ok: true, closings };
    });
  }

  /** Read-only. Does not count an SCCx poll and does not change the till. */
  async closingSummary(sccxShiftId: string) {
    const peek = (this.db as { peek?: () => Promise<State> }).peek;
    const state = peek ? await peek() : await this.db.transaction(async (tx) => tx.state);
    const view = closingSummaryView(state, sccxShiftId, tillCode());
    if (!view) throw new PosError(404, "CLOSING", "Closing was not found.");
    return view;
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
            const closing = buildClosing(tx.state, shift, noCountLines(tx.state, shift), true, at);
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
        const image = typeof raw.image_url === "string" ? raw.image_url : typeof raw.image === "string" ? raw.image : null;
        let price: number | null = null;
        if (typeof raw.default_price_cents === "number") price = Math.round(raw.default_price_cents);
        else if (typeof raw.price_cents === "number") price = Math.round(raw.price_cents);
        else if (typeof raw.price === "number") price = Math.round(raw.price * 100);
        let product = tx.state.products.find((item) => item.sku === sku);
        if (!product) {
          product = { sku, thc_flag: defaultThcCatalogFlag({ sku, name, category }), sku_sort: skuSortKey(sku), name, category, default_price_cents: price ?? 0, image_url: image, setb_active: active, synced_at: at, created_at: at };
          tx.state.products.push(product);
          tx.state.store_products.push({ store_code: tillCode(), sku, enabled: active, price_override_cents: null, created_at: at, updated_at: at });
        } else {
          product.name = name;
          product.category = category;
          product.thc_flag = defaultThcCatalogFlag({ sku, name, category });
          product.setb_active = active;
          if (price != null) product.default_price_cents = price;
          if (image != null) product.image_url = image;
          product.synced_at = at;
          product.sku_sort = skuSortKey(sku);
        }
        updated += 1;
      }
      return { ok: true, updated };
    });
    this.bumpMenu();
    return result;
  }

  async adminCountReview(adminToken: string) {
    return this.db.transaction(async (tx) => {
      requireAdmin(tx.state, adminToken, this.now());
      const shift = tx.state.shifts.find((row) => row.store_code === tillCode() && (row.status === "ACTIVE" || row.status === "CLOSING"));
      if (!shift) return { ok: true as const, opening: [], closing: [] };
      const view = collectVerify(tx.state, shift, "admin", this.now(), undefined, true, false);
      return { ok: true as const, opening: view.verify_admin?.opening ?? [], closing: view.verify_admin?.closing ?? [] };
    });
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

  /**
   * Remove the single completed debit sale on the open shift around 01:30 UTC.
   * More than one match is reported and left in place.
   */
  async removeTestDebit(token: string) {
    const start = Date.parse("2026-11-04T01:15:00.000Z");
    const end = Date.parse("2026-11-04T02:00:00.000Z");
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      const { shift, session } = this.session(tx.state, token, now);
      denyMaster(session);
      const describe = (saleId: string) => {
        const sale = tx.state.sales.find((row) => row.id === saleId);
        if (!sale) return null;
        const seller = tx.state.staff.find((row) => row.staff_uid === sale.staff_uid);
        return {
          ref_no: sale.ref_no,
          total_cents: sale.total_cents,
          created_at: sale.created_at,
          staff_name: seller?.display_name ?? "",
          lines: tx.state.sale_lines.filter((line) => line.sale_id === sale.id).map((line) => ({
            sku: line.sku,
            name: productName(tx.state, line.sku),
            qty: line.qty,
            unit_price_cents: line.unit_price_cents,
          })),
        };
      };
      const sales = tx.state.sales.filter((sale) => (
        sale.shift_id === shift.id
        && sale.status === "COMPLETED"
        && sale.payment_method === "DEBIT"
        && Date.parse(sale.created_at) >= start
        && Date.parse(sale.created_at) <= end
      ));
      if (sales.length !== 1) {
        return { ok: true as const, removed: false as const, candidates: sales.map((sale) => describe(sale.id)).filter((row) => row != null) };
      }
      const sale = sales[0]!;
      const detail = describe(sale.id);
      if (!detail) throw new PosError(404, "SALE", "Sale was not found.");
      const at = iso(now);
      for (const line of tx.state.sale_lines.filter((row) => row.sale_id === sale.id)) {
        const next = balanceAdd(tx.state, line.sku, line.qty, at, true);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not restore stock.");
        ledger(tx.state, line.sku, line.qty, "VOID", "sale", sale.id, "admin", "test debit removed", sale.shift_id, at);
      }
      tx.state.sales = tx.state.sales.filter((row) => row.id !== sale.id);
      tx.state.sale_lines = tx.state.sale_lines.filter((row) => row.sale_id !== sale.id);
      tx.state.outbox = tx.state.outbox.filter((row) => row.row_id !== `S-${sale.id}`);
      audit(tx.state, "TEST_DEBIT_REMOVED", "sale", sale.id, shift.staff_uid, detail as Json, at);
      const totals = shiftTotals(tx.state, shift.id);
      return { ok: true as const, removed: true as const, sale: detail, sale_id: sale.id, debit_sales_cents: totals.debit_sales_cents, cash_sales_cents: totals.cash_sales_cents };
    });
    if (result.removed) await this.deps.sheet.deleteRows("POS_Sales", [result.sale_id]);
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

  /**
   * Post the approved PNY02 opening once. Refuses to run on PNY01.
   * A SKU that already has PNY02 on-hand or an opening ledger row is left as it is.
   */
  async loadPny2StartingStock(adminToken: string, input: { key: string }) {
    const body = input as unknown as Json;
    if (tillCode() !== "PNY02") throw new PosError(409, "STORE", "This load is for PNY02 only.");
    if (!input.key?.trim()) throw new PosError(400, "KEY", "An idempotency key is required.");
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "pny2_starting_stock", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      const at = iso(now);
      this.ensurePny2(tx.state, at);
      const pny01Before = JSON.stringify(tx.state.balances.filter((row) => !row.store_code || row.store_code === "PNY01"));
      const loaded: { sku: string; qty: number }[] = [];
      const skipped: { sku: string; qty: number; reason: string }[] = [];
      const unmapped: { sku: string; qty: number; reason: string }[] = [];
      for (const line of pny2StartingLines()) {
        const already = tx.state.ledger.some((row) => row.sku === line.sku && row.movement_type === "OPENING_BALANCE" && balanceForStore(row));
        if (already || qtyOf(tx.state, line.sku) > 0) {
          skipped.push({ sku: line.sku, qty: qtyOf(tx.state, line.sku), reason: already ? "already_posted" : "already_on_hand" });
          continue;
        }
        ensureQuotedProduct(tx.state, line.sku, at);
        if (line.sku === "187-28g") {
          let priced = tx.state.products.find((row) => row.sku === line.sku);
          if (!priced) {
            priced = {
              sku: line.sku,
              sku_sort: skuSortKey(line.sku),
              name: "CHOCOLATE KUSH 28g",
              category: "BUDGET",
              default_price_cents: 5000,
              image_url: null,
              setb_active: true,
              synced_at: at,
              created_at: at,
            };
            tx.state.products.push(priced);
          } else if (priced.default_price_cents <= 0) {
            priced.name = "CHOCOLATE KUSH 28g";
            priced.category = "BUDGET";
            priced.default_price_cents = 5000;
            priced.setb_active = true;
          }
          if (!tx.state.store_products.some((row) => row.store_code === "PNY02" && row.sku === line.sku)) {
            tx.state.store_products.push({
              store_code: "PNY02",
              sku: line.sku,
              enabled: true,
              price_override_cents: null,
              created_at: at,
              updated_at: at,
            });
          }
        }
        const named = tx.state.products.find((row) => row.sku === line.sku);
        const paper = paperLines().find((row) => row.sku === line.sku);
        if (named && paper && named.name === line.sku) named.name = paper.name;
        if (!named || named.default_price_cents <= 0) unmapped.push({ sku: line.sku, qty: line.qty, reason: "no priced catalog row" });
        const next = balanceAdd(tx.state, line.sku, line.qty, at, true);
        if (next == null) throw new PosError(409, "OUT_OF_STOCK", "Could not post PNY02 starting stock.");
        ledger(tx.state, line.sku, line.qty, "OPENING_BALANCE", "admin", null, "admin", PNY2_START_NOTE, null, at);
        loaded.push({ sku: line.sku, qty: next });
      }
      const pny01After = JSON.stringify(tx.state.balances.filter((row) => !row.store_code || row.store_code === "PNY01"));
      if (pny01Before !== pny01After) throw new PosError(500, "PNY01", "PNY02 load touched PNY01 stock.");
      const resultBody = { ok: true, store: "PNY02", note: PNY2_START_NOTE, loaded, skipped, unmapped };
      remember(tx.state, "pny2_starting_stock", input.key, body, resultBody, now, this.deps.secrets.admin);
      return resultBody;
    });
    this.bumpMenu();
    return result;
  }

  async openingBalance(adminToken: string, input: { key: string; sku: string; qty: number }) {
    const body = input as unknown as Json;
    const result = await this.db.transaction(async (tx) => {
      const now = this.now();
      requireAdmin(tx.state, adminToken, now);
      const seen = replay(tx.state, "opening_balance", input.key, body, now, this.deps.secrets.admin);
      if (seen) return seen;
      if (!Number.isInteger(input.qty) || input.qty < 0) throw new PosError(400, "BAD_QTY", "Opening quantity must be a whole number.");
      if (tx.state.ledger.some((row) => row.sku === input.sku && row.movement_type === "OPENING_BALANCE" && balanceForStore(row))) {
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
        const closing = buildClosing(tx.state, shift, noCountLines(tx.state, shift), true, at);
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
      let storeProduct = tx.state.store_products.find((row) => row.store_code === tillCode() && row.sku === input.sku);
      const at = iso(this.now());
      if (!storeProduct) {
        storeProduct = { store_code: tillCode(), sku: input.sku, enabled: true, price_override_cents: null, created_at: at, updated_at: at };
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
          const storeProduct = tx.state.store_products.find((row) => row.store_code === tillCode() && row.sku === product.sku);
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
        stores: [{ code: tillCode(), name: "P60 Cannabis" }],
        summary: (() => {
          const open = tx.state.shifts.filter((shift) => shift.store_code === tillCode() && (shift.status === "ACTIVE" || shift.status === "CLOSING"));
          const source = open.length ? open : tx.state.shifts.filter((shift) => shift.store_code === tillCode()).slice(-1);
          const totals = source.reduce((sum, shift) => {
            const row = shiftTotals(tx.state, shift.id);
            return {
              sales_cents: sum.sales_cents + row.sales_total_cents,
              cash_sales_cents: sum.cash_sales_cents + row.cash_sales_cents,
              debit_sales_cents: sum.debit_sales_cents + row.debit_sales_cents,
              deposited_cents: sum.deposited_cents + row.deposited_cents,
            };
          }, { sales_cents: 0, cash_sales_cents: 0, debit_sales_cents: 0, deposited_cents: 0 });
          return {
            sales_cents: totals.sales_cents,
            cash_sales_cents: totals.cash_sales_cents,
            debit_sales_cents: totals.debit_sales_cents,
            deposited_cents: totals.deposited_cents,
            cash_on_hand_cents: totals.cash_sales_cents - totals.deposited_cents,
          };
        })(),
        staff_on_shift: tx.state.shifts
          .filter((shift) => shift.store_code === tillCode() && (shift.status === "ACTIVE" || shift.status === "CLOSING"))
          .map((shift) => ({
            id: shift.id,
            sccx_shift_id: shift.sccx_shift_id,
            staff_name: tx.state.staff.find((row) => row.staff_uid === shift.staff_uid)?.display_name ?? "Staff",
            started_at: shift.started_at,
            status: shift.status,
            pin_failed_attempts: shift.pin_failed_attempts,
          })),
        deposits: tx.state.deposits.map((deposit) => ({
          id: deposit.id,
          amount_cents: deposit.amount_cents,
          deposit_code: deposit.deposit_code ?? null,
          note: deposit.note,
          created_at: deposit.created_at,
          staff_name: tx.state.staff.find((row) => row.staff_uid === deposit.staff_uid)?.display_name ?? "",
        })),
        sales_detail: tx.state.sales.map((sale) => {
          const ticket = sale.ticket_id ? tx.state.tickets.find((row) => row.id === sale.ticket_id) : undefined;
          return {
            id: sale.id,
            ref_no: sale.ref_no,
            total_cents: sale.total_cents,
            status: sale.status,
            created_at: sale.created_at,
            ticket_code: ticket?.code ?? null,
            void_reason: sale.void_reason,
            lines: tx.state.sale_lines
              .filter((line) => line.sale_id === sale.id)
              .map((line) => ({ sku: line.sku, name: productName(tx.state, line.sku), qty: line.qty, line_total_cents: line.line_total_cents })),
          };
        }),
        tickets: tx.state.tickets.map((ticket) => {
          const lines = tx.state.ticket_lines.filter((line) => line.ticket_id === ticket.id);
          return {
            id: ticket.id,
            code: ticket.code,
            status: ticket.status,
            created_at: ticket.created_at,
            total_cents: lines.reduce((sum, line) => sum + line.qty * line.unit_price_cents_snapshot, 0),
            lines: lines.map((line) => ({ sku: line.sku, name: productName(tx.state, line.sku), qty: line.qty })),
          };
        }),
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
