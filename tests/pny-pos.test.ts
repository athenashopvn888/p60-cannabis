import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { TICKET_LETTERS } from "../app/lib/pny-pos/constants.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { emptyState, MemoryDb } from "../app/lib/pny-pos/memory.ts";
import { categoryChipLabel, defaultCategory, inStockCategories, layoutCategoryChips, layoutMenuCategoryChips, posDefaultCategory, signedMoney, sortCategories } from "../app/lib/pny-pos/money.ts";
import { insertRows } from "../app/lib/pny-pos/postgres.ts";
import { SCHEMA_SQL } from "../app/lib/pny-pos/schema.ts";
import { applyDemoSeed } from "../app/lib/pny-pos/seed.ts";
import { catalogFromFeed, DEFAULT_SETB_PRODUCTS_URL, readCommittedPnyCatalog } from "../app/lib/pny-pos/setbFeed.ts";
import { closingBalance, lineVariance } from "../app/lib/pny-pos/closing.ts";
import { cartonNote, unitPricesFromRawRows } from "../app/lib/pny-pos/rawPrice.ts";
import { salesFeedTokenOk } from "../app/lib/pny-pos/salesFeedAuth.ts";
import { END_SHIFT_MESSAGE, PosService } from "../app/lib/pny-pos/service.ts";
import { PAPER_BATCH, paperLines, paperPart2Lines, planPaperRefills } from "../app/lib/pny-pos/paperRefill.ts";
import { POS_TAB_SPECS, SheetDb } from "../app/lib/pny-pos/sheetStore.ts";
import { LocalSheet, sheetWriteAllowed } from "../app/lib/pny-pos/sheets.ts";
import type { Secrets } from "../app/lib/pny-pos/types.ts";
import { DEMO_PIN, KITCHEN_PIN } from "../app/lib/pny-pos/constants.ts";
import { bagLabel } from "../app/lib/pny-pos/flowerSku.ts";
import { customerMenuQr, CUSTOMER_MENU_URL } from "../app/pos/menuQr.ts";
import { quoteForSku, rawPriceRows } from "../app/lib/pny-pos/sizePrice.ts";
import { flowerPriceCents, flowersFromGrid, normalizeThc, overlayFlower, saleCents } from "../app/lib/pny-pos/flowerRaw.ts";
import { expandSetbItems, expandSkuCell, itemsFromGrid, itemsFromPriceSheetRows, mergeItemsPriceGrid, planItemsPriceRepair } from "../app/lib/pny-pos/itemRaw.ts";
import { demoMode } from "../app/lib/pny-pos/runtime.ts";
import { hideMobileBottomBar } from "../app/lib/mobileBottomBar.ts";
import { depositCodeLabel, nextDepositSeq } from "../app/lib/pny-pos/depositCode.ts";
import { runStore } from "../app/lib/pny-pos/storeContext.ts";
import { PNY02_STORE, PNY2_STOCK_HEADERS } from "../app/lib/pny-pos/storeProfile.ts";
import { historyPeriod, historySheetConfig } from "../app/lib/pny-pos/stockHistory.ts";
import { closeLabelFor, ensureStockLabel, masterIdFor } from "../app/lib/pny-pos/stockLabel.ts";
import { PNY2_START_KEY, PNY2_START_NOTE, pny2StartingLines } from "../app/lib/pny-pos/pny2StartingStock.ts";
import { chunkToken, readDemoDrafts, signDemoDrafts } from "../app/lib/pny-pos/demoDraft.ts";
import { blindStaffState } from "../app/lib/pny-pos/staffView.ts";
import { compareCount, signedOff, sizeLabel, staffSkuText } from "../app/lib/pny-pos/verifyCount.ts";
import { defaultThcCatalogFlag, isThcSku, THC_SKUS } from "../app/lib/pny-pos/thcSkuFlags.ts";

const secrets: Secrets = {
  shift: "test-shift-secret-value",
  roster: "test-roster-secret-value",
  poll: "test-poll-secret-value",
  session: "test-session-secret-value-32chars",
  admin: "test-admin-secret-value",
  cron: "test-cron-secret-value",
};

function harness(start = new Date("2026-11-03T15:00:00.000Z")) {
  const clock = { t: start };
  const sheet = new LocalSheet();
  const db = new MemoryDb();
  const svc = new PosService(db, { now: () => clock.t, sheet, secrets, demo: null });
  return { svc, db, sheet, clock };
}

test("Postgres projection batches rows instead of issuing one insert per row", async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client = {
    query: async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
  const rows = Array.from({ length: 750 }, (_, index) => ({
    id: `row-${index}`,
    action: "TEST",
    detail: { index },
    created_at: "2026-11-03T15:00:00.000Z",
  }));

  await insertRows(client as never, "audit_log", rows);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].values.length, 2000);
  assert.equal(calls[1].values.length, 1000);
  assert.match(calls[0].sql, /\$3::jsonb/);
  assert.match(calls[0].sql, /INSERT INTO audit_log/);
});

async function rejects(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof PosError, error instanceof Error ? error.message : "error");
    assert.equal((error as PosError).code, code);
    return true;
  });
}

async function readyTill(stock = { "1001": 2, "1002": 5 }) {
  const h = harness();
  await h.svc.syncSetb([
    { sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true },
    { sku: "1002", name: "Gummy", category: "Edible", price_cents: 500, active: true },
    { sku: "1009", name: "Retired", category: "Flower", price_cents: 100, active: false },
  ]);
  const admin = await h.svc.adminLogin(secrets.admin);
  for (const [sku, qty] of Object.entries(stock)) {
    await h.svc.openingBalance(admin.token, { key: `ob-${sku}`, sku, qty });
  }
  await h.svc.importRoster({
    key: "roster",
    staff: [
      { staff_uid: "staff-a", sccx_id: "a", pos_id: "A1", display_name: "Ada", active: true },
      { staff_uid: "staff-b", sccx_id: "b", pos_id: "B1", display_name: "Bea", active: true },
    ],
  });
  const started = await h.svc.startShift({ key: "start-a", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "sccx-a" });
  const login = await h.svc.login(String(started.pin), "10.0.0.8");
  await h.svc.answerWeedInStore(login.token, true);
  await h.svc.state(login.token);
  return { ...h, admin: admin.token, token: login.token, pin: String(started.pin), shiftId: String(started.shift_id) };
}

async function submitClosingValues(svc: PosService, token: string, values: Record<string, number> = {}) {
  const view = await svc.state(token);
  for (const line of view.close_lines ?? []) {
    await svc.saveClosingCount(token, {
      sku: line.sku,
      counted_qty: values[line.sku] ?? line.system_qty,
    });
  }
  await svc.submitClosingCount(token);
}

function qty(db: MemoryDb, sku: string) {
  return db.state.balances.find((row) => row.sku === sku)?.qty ?? 0;
}

function keysDeep(value: unknown, found = new Set<string>()) {
  if (Array.isArray(value)) for (const item of value) keysDeep(item, found);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysDeep(child, found);
    }
  }
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

test("1. shift start returns a PIN and the same request id replays it", async () => {
  const h = harness();
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const first = await h.svc.startShift({ key: "req-1", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "sccx-1" });
  const second = await h.svc.startShift({ key: "req-1", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "sccx-1" });
  assert.match(String(first.pin), /^\d{4}$/);
  assert.equal(second.pin, first.pin);
  assert.equal(h.db.state.shifts.length, 1);
  await rejects(
    () => h.svc.startShift({ key: "req-1", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "other" }),
    "IDEMPOTENCY_CONFLICT",
  );
  h.clock.t = new Date(h.clock.t.getTime() + 16 * 60 * 1000);
  const purged = await h.svc.startShift({ key: "req-1", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "sccx-1" });
  assert.equal(purged.pin, null);
  assert.equal(purged.pin_purged, true);
  assert.equal(h.db.state.shifts.length, 1);
});

test("2. a new on-shift ends the previous shift and rejects its session", async () => {
  const h = await readyTill();
  const next = await h.svc.startShift({ key: "start-b", store: "PNY01", staff_ref: "staff-b", pos_id: "B1", shift_id: "sccx-b" });
  assert.equal(next.ticket_letter, "B");
  assert.equal(h.db.state.shifts.find((shift) => shift.sccx_shift_id === "sccx-a")?.status, "ENDED");
  await rejects(() => h.svc.state(h.token), "NO_SESSION");
  await rejects(() => h.svc.login(h.pin, "10.0.0.9"), "BAD_PIN");
  assert.notEqual(next.pin, h.pin);
});

test("3. SCCx off shift kills the PIN and flags the summary as no count", async () => {
  const h = await readyTill();
  const ended = await h.svc.endShiftFromSccx({ key: "off-1", store: "PNY01", shift_id: "sccx-a", reason: "SCCX_OFF" });
  assert.equal(ended.no_count, true);
  assert.equal(ended.end_reason, "SCCX_OFF");
  assert.match(String(h.db.state.closings[0]?.summary_text), /No count taken/);
  await rejects(() => h.svc.login(h.pin, "10.0.0.8"), "NO_SHIFT");
  await rejects(() => h.svc.state(h.token), "NO_SESSION");
});

test("4. five bad PINs lock the shift, admin reissue works, and a 14 hour PIN is rejected", async () => {
  const h = await readyTill();
  await rejects(() => h.svc.login("000000", "10.1.0.4"), "BAD_PIN");
  assert.equal(h.db.state.shifts.find((shift) => shift.sccx_shift_id === "sccx-a")?.pin_failed_attempts, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) await rejects(() => h.svc.login("0000", "10.1.0.5"), "BAD_PIN");
  await rejects(() => h.svc.login("0000", "10.1.0.5"), "LOCKED");
  assert.equal(h.db.state.shifts.find((shift) => shift.sccx_shift_id === "sccx-a")?.status, "LOCKED");
  const reissued = await h.svc.reissuePin(h.admin, { key: "reissue-1", shift_id: "sccx-a" });
  assert.match(String(reissued.pin), /^\d{4}$/);
  assert.notEqual(reissued.pin, h.pin);
  await rejects(() => h.svc.login(h.pin, "10.1.0.6"), "BAD_PIN");
  const again = await h.svc.login(String(reissued.pin), "10.1.0.6");
  assert.equal(again.ok, true);

  const aged = harness();
  await aged.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await aged.svc.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", shift_id: "old" });
  aged.clock.t = new Date(aged.clock.t.getTime() + 14 * 60 * 60 * 1000 + 1000);
  await rejects(() => aged.svc.login(String(started.pin), "10.9.0.1"), "NO_SHIFT");
  assert.equal(aged.db.state.shifts[0]?.status, "ENDED");
  assert.equal(aged.db.state.shifts[0]?.end_reason, "EXPIRED");
});

test("5. a pending refill is starting stock and 105-28g of 2 needs no reason", async () => {
  const h = harness();
  await h.svc.syncSetb([{ sku: "105-28g", name: "SPACE COOKIES 28g", category: "BUDGET", price_cents: 4000, active: true }]);
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-a" });
  const login = await h.svc.login(String(started.pin), "10.0.0.1");
  await h.svc.answerWeedInStore(login.token, true);
  const refillId = crypto.randomUUID();
  h.db.state.incoming.push({
    kitchen_row_id: refillId,
    batch_id: "paper",
    store_code: "PNY01",
    sku: "105-28g",
    qty_sent: 2,
    kind: "REFILL",
    kitchen_created_at: "2026-11-03T18:00:00.000Z",
    imported_at: "2026-11-03T18:00:00.000Z",
    status: "PENDING_CONFIRM",
    qty_received: null,
    variance_reason: null,
    confirmed_shift_id: null,
    confirmed_at: null,
    linked_ledger_id: null,
    created_at: "2026-11-03T18:00:00.000Z",
  });
  const waiting = await h.svc.state(login.token);
  assert.equal(waiting.phase, "sell");
  assert.equal(waiting.block, null);
  assert.equal(qty(h.db, "105-28g"), 0);
  assert.equal(waiting.incoming?.find((row) => row.kitchen_row_id === refillId)?.qty_sent, 2);
  assert.equal(h.db.state.incoming.find((row) => row.kitchen_row_id === refillId)?.status, "PENDING_CONFIRM");
  await h.svc.confirmIncoming(login.token, { key: "receive-105", lines: [{ kitchen_row_id: refillId, qty_received: 2 }] });
  assert.equal(qty(h.db, "105-28g"), 2);
  const refill = h.db.state.incoming.find((row) => row.kitchen_row_id === refillId);
  assert.equal(refill?.status, "CONFIRMED");
  assert.equal(refill?.qty_received, 2);
  assert.equal(refill?.qty_sent, 2);
  const menu = await h.svc.menu();
  assert.equal(menu.prices_include_tax, false);
  assert.equal(menu.items?.some((item) => item.sku === "105-28g" && item.price_cents === 4000), true);
  await h.svc.cashout(login.token, { key: "sale", lines: [{ sku: "105-28g", qty: 1 }] });
  assert.equal(qty(h.db, "105-28g"), 1);
});

test("a sized refill is listed on the menu and tobacco stays off", async () => {
  const flower = quoteForSku("313-5g");
  const tobacco = quoteForSku("240");
  assert.equal(flower?.source, "SETB");
  assert.equal(flower?.cents, 3000);
  assert.equal(tobacco?.category.toLowerCase(), "cigarettes");
  const h = harness();
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-menu" });
  const login = await h.svc.login(String(started.pin), "10.0.0.41");
  await h.svc.answerWeedInStore(login.token, true);
  for (const sku of ["313-5g", "240"]) {
    h.db.state.incoming.push({
      kitchen_row_id: crypto.randomUUID(),
      batch_id: "paper",
      store_code: "PNY01",
      sku,
      qty_sent: 1,
      kind: "REFILL",
      kitchen_created_at: "2026-11-03T18:00:00.000Z",
      imported_at: "2026-11-03T18:00:00.000Z",
      status: "PENDING_CONFIRM",
      qty_received: null,
      variance_reason: null,
      confirmed_shift_id: null,
      confirmed_at: null,
      linked_ledger_id: null,
      created_at: "2026-11-03T18:00:00.000Z",
    });
  }
  const waiting = await h.svc.state(login.token);
  assert.equal(waiting.phase, "sell");
  assert.equal(qty(h.db, "313-5g"), 0);
  assert.equal((await h.svc.menu()).items?.some((item) => item.sku === "313-5g"), false);
  const pending = h.db.state.incoming.filter((row) => row.status === "PENDING_CONFIRM");
  await h.svc.confirmIncoming(login.token, { key: "receive-sized", lines: pending.map((row) => ({ kitchen_row_id: row.kitchen_row_id, qty_received: row.qty_sent })) });
  const view = await h.svc.state(login.token);
  assert.equal(view.products.some((product) => product.sku === "313-5g" && product.price_cents === 3000), true);
  const menu = await h.svc.menu();
  assert.equal(menu.prices_include_tax, false);
  assert.equal(menu.items?.some((item) => item.sku === "313-5g" && item.price_cents === 3000 && item.name.includes("SUPER LEMON")), true);
  assert.equal(menu.items?.some((item) => item.sku === "240" && item.category.toLowerCase() === "cigarettes" && item.price_cents === 500), true);
  assert.equal(JSON.stringify(menu).includes("\"qty\""), false);
  const order = await h.svc.placeOrder({ key: "menu-313", lines: [{ sku: "313-5g", qty: 1 }] }, "10.0.0.42");
  assert.equal(order.prices_include_tax, false);
});

test("6. two concurrent cashouts of the last unit cannot take stock below zero", async () => {
  const h = await readyTill({ "1001": 1, "1002": 0 });
  const [first, second] = await Promise.allSettled([
    h.svc.cashout(h.token, { key: "c1", lines: [{ sku: "1001", qty: 1 }] }),
    h.svc.cashout(h.token, { key: "c2", lines: [{ sku: "1001", qty: 1 }] }),
  ]);
  const ok = [first, second].filter((result) => result.status === "fulfilled");
  const denied = [first, second].filter((result) => result.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(denied.length, 1);
  assert.equal((denied[0] as PromiseRejectedResult).reason.code, "OUT_OF_STOCK");
  assert.equal(qty(h.db, "1001"), 0);
  assert.equal(h.db.state.sales.length, 1);
});

test("7. one idempotency key creates one sale and a different body conflicts", async () => {
  const h = await readyTill();
  const sale = { key: "sale-1", lines: [{ sku: "1001", qty: 1 }] };
  const first = await h.svc.cashout(h.token, sale);
  const second = await h.svc.cashout(h.token, sale);
  assert.equal(second.sale_id, first.sale_id);
  assert.equal(h.db.state.sales.length, 1);
  assert.equal(qty(h.db, "1001"), 1);
  await rejects(() => h.svc.cashout(h.token, { key: "sale-1", lines: [{ sku: "1001", qty: 2 }] }), "IDEMPOTENCY_CONFLICT");
  assert.equal(h.db.state.sales.length, 1);
});

test("8. the total is the sum of server prices with tax included and client prices ignored", async () => {
  const h = await readyTill();
  const sale = await h.svc.cashout(h.token, {
    key: "sale-price",
    lines: [
      { sku: "1002", qty: 2, unit_price_cents: 1 },
      { sku: "1001", qty: 1, unit_price_cents: 5 },
    ],
  });
  assert.equal(sale.prices_tax_included, true);
  assert.equal(sale.total_cents, 500 * 2 + 1000);
  assert.deepEqual(
    sale.lines.map((line) => line.unit_price_cents).sort((a, b) => a - b),
    [500, 1000],
  );
  const stored = h.db.state.sales[0];
  assert.equal(stored?.prices_tax_included, true);
  assert.equal(stored?.total_cents, 2000);
  assert.equal(h.db.state.sale_lines.every((line) => line.unit_price_cents !== 1 && line.unit_price_cents !== 5), true);
});

test("9. header totals follow sale, deposit and void", async () => {
  const h = await readyTill();
  await h.svc.cashout(h.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] });
  await h.svc.deposit(h.token, { key: "drop", amount_cents: 400, note: "safe" });
  const mid = await h.svc.state(h.token);
  assert.deepEqual(mid.totals, { sales_cents: 1000, cash_sales_cents: 1000, debit_sales_cents: 0, cash_on_hand_cents: 600, deposited_cents: 400 });
  const saleId = h.db.state.sales[0]?.id ?? "";
  await rejects(() => h.svc.voidSale(h.token, { key: "staff-void", sale_id: saleId, reason: "no" }), "ADMIN_ONLY");
  await h.svc.voidSale(h.admin, { key: "void-1", sale_id: saleId, reason: "mis-ring" });
  const after = await h.svc.state(h.token);
  assert.deepEqual(after.totals, { sales_cents: 0, cash_sales_cents: 0, debit_sales_cents: 0, cash_on_hand_cents: -400, deposited_cents: 400 });
  assert.equal(qty(h.db, "1001"), 2);
});

test("10. a QR order gets a rotating ticket code, expires without stock movement, and cashout deducts", async () => {
  const h = await readyTill();
  const order = await h.svc.placeOrder({ key: "order-1", lines: [{ sku: "1002", qty: 1 }, { sku: "1001", qty: 1 }] }, "10.4.0.1");
  assert.match(String(order.code), /^[A-HJ-NP-Z]\d{3}$/);
  const view = await h.svc.state(h.token);
  assert.equal(view.tickets.some((ticket) => ticket.code === order.code), true);
  const before = qty(h.db, "1002");
  h.clock.t = new Date(h.clock.t.getTime() + 31 * 60 * 1000);
  await h.svc.expireDue();
  assert.equal(qty(h.db, "1002"), before);
  assert.equal(h.db.state.tickets.find((ticket) => ticket.code === order.code)?.status, "EXPIRED");

  const fresh = await readyTill();
  const live = await fresh.svc.placeOrder({ key: "order-live", lines: [{ sku: "1001", qty: 1 }] }, "10.4.0.2");
  const ticket = (await fresh.svc.state(fresh.token)).tickets.find((row) => row.code === live.code);
  assert.ok(ticket);
  const beforeCash = qty(fresh.db, "1001");
  await fresh.svc.cashout(fresh.token, { key: "cash-ticket", ticket_id: ticket.id, lines: ticket.lines.map((line) => ({ sku: line.sku, qty: line.qty })) });
  assert.equal(qty(fresh.db, "1001"), beforeCash - 1);
  assert.equal(fresh.db.state.tickets.find((row) => row.id === ticket.id)?.status, "CASHED_OUT");

  assert.equal(TICKET_LETTERS.includes("I"), false);
  assert.equal(TICKET_LETTERS.includes("O"), false);
  assert.equal(TICKET_LETTERS[8], "J");
  assert.equal(TICKET_LETTERS[13], "P");
  fresh.db.state.stores[0]!.ticket_letter_seq = 8;
  const jumped = await fresh.svc.startShift({ key: "letter-j", store: "PNY01", staff_ref: "staff-b", shift_id: "sccx-j" });
  assert.equal(jumped.ticket_letter, "J");
});

test("11. the public menu hides out of stock, disabled and inactive items and has no private fields", async () => {
  const h = await readyTill();
  await h.svc.setPrice(h.admin, { sku: "1002", enabled: false });
  await h.svc.openingBalance(h.admin, { key: "ob-1009", sku: "1009", qty: 4 });
  await h.svc.cashout(h.token, { key: "sell-out", lines: [{ sku: "1001", qty: 2 }] });
  const menu = await h.svc.menu();
  assert.deepEqual(menu.items, []);
  const stocked = await readyTill({ "1001": 2, "1002": 1 });
  await stocked.svc.setPrice(stocked.admin, { sku: "1002", enabled: false });
  const shown = await stocked.svc.menu();
  assert.deepEqual(shown.items?.map((item) => item.sku), ["1001"]);
  assert.equal(shown.items?.[0]?.availability, "Available");
  assert.equal(shown.prices_include_tax, false);
  const names = keysDeep(shown);
  for (const banned of ["qty", "quantity", "on_hand", "pin", "balance", "ledger", "deposited", "cash_on_hand", "staff_uid"]) {
    assert.equal(names.has(banned), false, banned);
  }
  assert.deepEqual(inStockCategories([{ category: "Vape", qty: 0 }, { category: "Flower", qty: 2 }, { category: "Edible", qty: 1 }]), ["Edible", "Flower"]);
  assert.deepEqual(sortCategories([
    "Concentrates", "AA", "Vape", "CIGARETTES", "Exotic", "Budget", "ADD ONS", "Premium", "AAA+", "Edibles", "Flower", "tobacco",
  ]), ["Exotic", "Premium", "AAA+", "AA", "Budget", "ADD ONS", "CIGARETTES", "tobacco", "Edibles", "Concentrates", "Flower", "Vape"]);
  assert.equal(defaultCategory(["EXOTIC", "ADD ONS", "BUDGET"]), "ADD ONS");
  assert.equal(categoryChipLabel("ADD ONS"), "Add Ons");
  assert.equal(categoryChipLabel("CIGARETTES"), "Cigs");
  assert.equal(categoryChipLabel("PREROLLS"), "PreRolls");
  assert.equal(categoryChipLabel("PRE-ROLLS"), "PreRolls");
  assert.equal(categoryChipLabel("EDIBLES"), "Edibles");
  assert.equal(categoryChipLabel("MAGIC & OTHERS"), "Magic");
  assert.equal(categoryChipLabel("VAPE DISPOSABLE"), "THC Vape");
  assert.equal(categoryChipLabel("VAPE PENS"), "Nic Vape");
  assert.equal(categoryChipLabel("EXOTIC"), "EXOTIC");
  assert.equal(categoryChipLabel("CONCENTRATES"), "CONCENTRATES");
  const source = ["EXOTIC", "PREMIUM", "AAA+", "AA", "BUDGET", "ADD ONS", "CIGARETTES", "EDIBLES", "VAPE DISPOSABLE", "VAPE PENS"];
  const chips = layoutCategoryChips(source);
  assert.equal(chips[5], "VAPE PENS");
  assert.equal(chips[6], "ADD ONS");
  assert.equal(chips[source.length - 1], "CIGARETTES");
  assert.deepEqual(chips.filter((name) => name !== "ADD ONS" && name !== "VAPE PENS" && name !== "CIGARETTES"), source.filter((name) => name !== "ADD ONS" && name !== "VAPE PENS" && name !== "CIGARETTES"));
  assert.equal(defaultCategory(["Exotic", "Premium"]), "Exotic");
  assert.equal(posDefaultCategory(["ADD ONS", "CIGARETTES", "EDIBLES"]), "CIGARETTES");
  const menuChips = layoutMenuCategoryChips(source);
  assert.equal(menuChips[5], "VAPE PENS");
  assert.equal(menuChips[6], "CIGARETTES");
  assert.equal(menuChips[menuChips.length - 1], "ADD ONS");
  assert.equal(menuChips.includes("CIGARETTES"), true);
  const menuAppSource = readFileSync("app/menu/MenuApp.tsx", "utf8");
  assert.match(menuAppSource, /defaultCategory\(categories\)/);
  assert.match(menuAppSource, /layoutMenuCategoryChips\(categories\)/);
  assert.match(menuAppSource, /categoryChipLabel\(name\)/);
  assert.doesNotMatch(menuAppSource, /SHOW_CIGARETTES|filterCigarette/);
  assert.match(readFileSync("app/pos/PosApp.tsx", "utf8"), /posDefaultCategory\(categories\)/);
  assert.doesNotMatch(readFileSync("app/pos/PosApp.tsx", "utf8"), /layoutMenuCategoryChips/);
});

test("12. a kitchen allocation is incoming and not sellable until it is confirmed", async () => {
  const h = await readyTill({ "1001": 1, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "b1", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "3", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" }];
  const imported = await h.svc.refreshIncoming({ force: true });
  assert.equal(imported.imported, 1);
  assert.equal(qty(h.db, "1001"), 1);
  assert.equal(h.db.state.incoming[0]?.status, "PENDING_CONFIRM");
  const view = await h.svc.state(h.token);
  assert.equal(view.phase, "sell");
  assert.equal(qty(h.db, "1001"), 1);
  assert.equal(h.db.state.incoming[0]?.status, "PENDING_CONFIRM");
  await h.svc.confirmIncoming(h.token, { key: "receive-alloc", lines: [{ kitchen_row_id: rowId, qty_received: 3 }] });
  assert.equal(qty(h.db, "1001"), 4);
  assert.equal(h.db.state.incoming[0]?.qty_received, 3);
  await h.svc.cashout(h.token, { key: "after", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(qty(h.db, "1001"), 3);
});

test("13. re-importing a row and double-confirming add stock once", async () => {
  const h = await readyTill({ "1001": 0, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "b1", store_code: "PNY01", kind: "REFILL", sku: "1001", qty: "2", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  await h.svc.refreshIncoming({ force: true });
  assert.equal(h.db.state.incoming.length, 1);
  await h.svc.confirmIncoming(h.token, { key: "once", lines: [{ kitchen_row_id: rowId, qty_received: 2 }] });
  const replay = await h.svc.confirmIncoming(h.token, { key: "once", lines: [{ kitchen_row_id: rowId, qty_received: 2 }] });
  assert.equal(replay.replay, true);
  await rejects(() => h.svc.confirmIncoming(h.token, { key: "twice", lines: [{ kitchen_row_id: rowId, qty_received: 2 }] }), "ALREADY_CONFIRMED");
  assert.equal(qty(h.db, "1001"), 2);
  assert.equal(h.db.state.ledger.filter((row) => row.movement_type === "INCOMING_CONFIRM").length, 1);
});

test("14. a partial receipt needs a reason and the receipt shows the variance", async () => {
  const h = await readyTill({ "1001": 0, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "b9", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "4", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  await h.svc.confirmIncoming(h.token, { key: "partial-ok", lines: [{ kitchen_row_id: rowId, qty_received: 1 }] });
  assert.equal(qty(h.db, "1001"), 1);
  const receipt = h.db.state.outbox.find((row) => row.row_id === `R-${rowId}`);
  assert.equal(receipt?.payload.status, "PARTIAL");
  assert.equal(receipt?.payload.variance, "-3");
  assert.equal(receipt?.payload.variance_reason, "");
});

test("15. a kitchen cancel before confirm is acknowledged and a cancel after confirm is ignored", async () => {
  const h = await readyTill({ "1001": 0, "1002": 0 });
  const early = crypto.randomUUID();
  const late = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [
    { row_id: early, batch_id: "e", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "2", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" },
    { row_id: late, batch_id: "l", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "2", created_at: "2026-11-03T15:05:00+07:00", kitchen_status: "ACTIVE" },
  ];
  await h.svc.refreshIncoming({ force: true });
  h.sheet.tabs.K_Allocations[0]!.kitchen_status = "CANCELLED";
  await h.svc.refreshIncoming({ force: true });
  assert.equal(h.db.state.incoming.find((row) => row.kitchen_row_id === early)?.status, "CANCELLED_BY_KITCHEN");
  assert.equal(h.db.state.outbox.find((row) => row.row_id === `R-${early}`)?.payload.status, "CANCEL_ACK");
  await h.svc.confirmIncoming(h.token, { key: "keep", lines: [{ kitchen_row_id: late, qty_received: 2 }] });
  h.sheet.tabs.K_Allocations[1]!.kitchen_status = "CANCELLED";
  await h.svc.refreshIncoming({ force: true });
  assert.equal(h.db.state.incoming.find((row) => row.kitchen_row_id === late)?.status, "CONFIRMED");
  assert.equal(h.db.state.audit.some((row) => row.action === "CANCEL_AFTER_CONFIRM"), true);
  assert.equal(qty(h.db, "1001"), 2);
});

test("16. editing an imported kitchen qty does not change PNY stock and raises an alert", async () => {
  const h = await readyTill({ "1001": 0, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "b", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "3", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  h.sheet.tabs.K_Allocations[0]!.qty = "9";
  await h.svc.refreshIncoming({ force: true });
  assert.equal(h.db.state.incoming[0]?.qty_sent, 3);
  assert.equal(qty(h.db, "1001"), 0);
  assert.equal(h.db.state.audit.some((row) => row.action === "QTY_CHANGED_AFTER_IMPORT"), true);
});

test("17. sales, deposits and counts succeed while the sheet is down and the outbox catches up once", async () => {
  const h = harness();
  await h.svc.syncSetb([{ sku: "1001", name: "Flower", category: "Flower", price_cents: 1500, active: true }]);
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "ob", sku: "1001", qty: 4 });
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-a" });
  const login = await h.svc.login(String(started.pin), "10.0.0.4");
  await h.svc.answerWeedInStore(login.token, true);
  h.sheet.reachable = false;
  await h.svc.saveOpeningCount(login.token, { sku: "1001", counted_qty: 4 });
  await h.svc.submitVerifyCount(login.token);
  await h.svc.cashout(login.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] });
  await h.svc.deposit(login.token, { key: "drop", amount_cents: 500 });
  const delayed = await h.svc.drainOutbox();
  assert.equal(delayed.sheet_down, true);
  assert.equal(h.sheet.tabs.S_Sales, undefined);
  assert.ok(h.db.state.outbox.some((row) => row.status === "queued"));
  h.sheet.reachable = true;
  h.clock.t = new Date(h.clock.t.getTime() + 60 * 1000);
  await h.svc.drainOutbox();
  await h.svc.drainOutbox();
  const sales = h.sheet.tabs.S_Sales ?? [];
  assert.equal(sales.length, 1);
  assert.equal(new Set(sales.map((row) => row.row_id)).size, sales.length);
  await h.svc.cashout(login.token, { key: "sale-2", lines: [{ sku: "1001", qty: 1 }] });
  h.clock.t = new Date(h.clock.t.getTime() + 11 * 60 * 1000);
  const view = await h.svc.state(login.token);
  assert.equal(view.sheet_sync_delayed, true);
});

test("18. an emergency adjustment and a late kitchen row are linked without double counting", async () => {
  const h = await readyTill({ "1001": 0, "1002": 0 });
  const adjusted = await h.svc.adjust(h.admin, { key: "adj", sku: "1001", qty_delta: 4, reason: "KITCHEN_DELIVERY_SHEET_DOWN" });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "late", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "4", created_at: "2026-11-03T16:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  assert.equal(qty(h.db, "1001"), 4);
  const linked = await h.svc.linkAdjustment(h.admin, { key: "link", kitchen_row_id: rowId, ledger_id: String(adjusted.ledger_id), decision: "CONFIRM" });
  assert.equal(linked.unchanged, true);
  assert.equal(qty(h.db, "1001"), 4);
  await rejects(() => h.svc.confirmIncoming(h.token, { key: "again", lines: [{ kitchen_row_id: rowId, qty_received: 4 }] }), "ALREADY_CONFIRMED");
  assert.equal(qty(h.db, "1001"), 4);
});

test("19. POS end shift kills the PIN and queues closing counts, summary and stock", async () => {
  const h = await readyTill();
  const view = await h.svc.state(h.token);
  await submitClosingValues(h.svc, h.token, { "1001": 0 });
  const ended = await h.svc.endShiftFromPos(h.token, {
    key: "end",
    lines: view.count_lines.map((line) => line.sku === "1001"
      ? { sku: line.sku, counted_qty: 0, variance_reason: "physical close count" }
      : { sku: line.sku, counted_qty: line.system_qty }),
  });
  assert.equal(ended.message, END_SHIFT_MESSAGE);
  assert.match(ended.message, /within 5 min/);
  assert.equal(h.db.state.shifts.find((shift) => shift.id === h.shiftId)?.status, "ENDED");
  assert.equal(h.db.state.shifts.find((shift) => shift.id === h.shiftId)?.end_reason, "POS_END");
  assert.equal(qty(h.db, "1001"), 0);
  assert.ok(h.db.state.ledger.some((row) => row.sku === "1001" && row.movement_type === "COUNT_VARIANCE"));
  await rejects(() => h.svc.login(h.pin, "10.0.0.8"), "NO_SHIFT");
  const tabs = new Set(h.db.state.outbox.map((row) => row.tab));
  assert.equal(tabs.has("S_ClosingCounts"), true);
  assert.equal(tabs.has("S_ShiftSummary"), true);
  assert.equal(tabs.has("S_Stock"), true);
  await h.svc.drainOutbox();
  assert.ok((h.sheet.tabs.S_ClosingCounts ?? []).length > 0);
  assert.ok((h.sheet.tabs.S_Stock ?? []).some((row) => row.sku === "1001" && row.on_hand === "0"));
});

test("20. closed shifts are polled once and ack is safe to repeat", async () => {
  const h = await readyTill();
  await h.svc.cashout(h.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] });
  await h.svc.deposit(h.token, { key: "drop", amount_cents: 200 });
  const view = await h.svc.state(h.token);
  await submitClosingValues(h.svc, h.token);
  await h.svc.endShiftFromPos(h.token, { key: "end", lines: view.count_lines.map((line) => ({ sku: line.sku, counted_qty: line.system_qty })) });
  const first = await h.svc.closedShifts();
  assert.equal(first.closings.length, 1);
  const row = first.closings[0];
  assert.equal(row?.shift_id, "sccx-a");
  assert.equal(row?.money_unit, "cents");
  assert.equal(row?.sales_total, 1000);
  assert.equal(row?.deposited, 200);
  assert.equal(row?.cash_on_hand, 800);
  assert.match(row?.summary_text ?? "", /Sales:/);
  assert.match(row?.summary_text ?? "", /COH:/);
  assert.match(row?.summary_text ?? "", /Deposited:/);
  assert.match(row?.summary_text ?? "", /Tickets:/);
  await h.svc.ackClosedShift("sccx-a", { key: "ack-1" });
  const second = await h.svc.closedShifts();
  assert.equal(second.closings.length, 0);
  const again = await h.svc.ackClosedShift("sccx-a", { key: "ack-1" });
  assert.equal(again.replay, true);
  const third = await h.svc.closedShifts();
  assert.equal(third.closings.length, 0);
});

test("21. SETB on-hand is ignored and PNY balances stay independent", async () => {
  const h = await readyTill({ "1001": 2, "1002": 0 });
  await h.svc.syncSetb([{ sku: "1001", name: "Flower renamed", category: "Flower", price_cents: 1100, active: true, on_hand: 999, qty: 999, stock: 999 }]);
  assert.equal(qty(h.db, "1001"), 2);
  assert.equal(h.db.state.products.find((row) => row.sku === "1001")?.name, "Flower renamed");
  assert.equal(h.db.state.products.find((row) => row.sku === "1001")?.default_price_cents, 1100);
  const source = readFileSync("app/lib/pny-pos/service.ts", "utf8") + readFileSync("app/api/cron/setb-sync/route.ts", "utf8");
  assert.doesNotMatch(source, /flowers\.json|items\.json|onhand\.csv|liveMenu|cigaretteFeed|APPS_SCRIPT_URL|prebuild-stock/);
});

test("22 and 26. PNY has no kitchen credentials and does not track a kitchen on-hand", async () => {
  const files = [...walk("app/lib/pny-pos"), ...walk("app/api/shifts"), ...walk("app/api/sccx"), ...walk("app/api/roster"), ...walk("app/api/pos"), ...walk("app/api/menu"), ...walk("app/api/cron")];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /GOOGLE_SA_KITCHEN|KITCHEN_URL|kitchen_on_hand|kitchenOnHand/);
  const h = await readyTill({ "1001": 0, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "any", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "999999", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  assert.equal(h.db.state.incoming[0]?.status, "PENDING_CONFIRM");
  assert.equal(qty(h.db, "1001"), 0);
});

test("23. shift, roster and closing code does not reference SOD", () => {
  const files = [...walk("app/lib/pny-pos"), ...walk("app/api/shifts"), ...walk("app/api/sccx"), ...walk("app/api/roster"), ...walk("app/api/pos"), ...walk("app/api/cron")];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /\bSOD\b|\/api\/gateway\/send|signal-cli|SOD_/);
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  assert.doesNotMatch(sitemap, /\/pos|\/menu|\/kitchen/);
  assert.equal(hideMobileBottomBar("/pos"), true);
  assert.equal(hideMobileBottomBar("/menu"), true);
  assert.equal(hideMobileBottomBar("/kitchen"), true);
  const menuApp = readFileSync("app/menu/MenuApp.tsx", "utf8");
  assert.match(menuApp, /pny-menu-layout/);
  const nextConfig = readFileSync("next.config.ts", "utf8");
  assert.match(nextConfig, /source: "\/kitchen", destination: "https:\/\/mobile-kitchen-two\.vercel\.app\/"/);
  assert.match(nextConfig, /source: "\/pos\/admin", destination: "https:\/\/mobile-kitchen-two\.vercel\.app\/admin"/);
  assert.equal(existsSync("app/kitchen/page.tsx"), false);
  assert.equal(existsSync("app/pos/admin/page.tsx"), false);
  assert.equal(existsSync("app/api/kitchen/login/route.ts"), false);
  assert.equal(existsSync("app/api/admin/login/route.ts"), false);
  const posApp = readFileSync("app/pos/PosApp.tsx", "utf8");
  const tillApp = readFileSync("app/pos/till/TillApp.tsx", "utf8");
  assert.match(posApp, /filterSellProducts/);
  assert.match(readFileSync("app/pos/posSearch.ts", "utf8"), /isFlowerCategory/);
  assert.match(posApp, /data-layout="list"/);
  assert.match(posApp, /data-size=/);
  assert.doesNotMatch(posApp, /stockCount|demo stock|qty_sent|System /);
  assert.doesNotMatch(readFileSync("app/pos/OpeningCount.tsx", "utf8"), /System |incoming_qty|system_qty/);
  assert.doesNotMatch(readFileSync("app/pos/CloseShift.tsx", "utf8"), /Expected |shortage_qty|system_qty/);
  assert.doesNotMatch(tillApp, /system_qty|Sent /);
  assert.doesNotMatch(posApp.split('data-layout="list"')[0]?.split("isFlowerCategory(product.category)")[1] ?? "", /ProductPhoto/);
  assert.match(posApp, /usePosPoll/);
  const poll = readFileSync("app/pos/usePosPoll.ts", "utf8");
  assert.match(poll, /POS_STATE_POLL_MS = 25_000/);
  assert.match(poll, /document\.hidden/);
  assert.match(readFileSync("app/pos/till/TillApp.tsx", "utf8"), /usePosPoll/);
  assert.match(posApp, /"\/pos\/till"/);
  assert.match(posApp, /End Shift/);
  assert.doesNotMatch(posApp, /data-testid="total-sales"/);
  assert.match(posApp, /data-testid="clear-cart"/);
  assert.match(posApp, /disabled=\{cartEmpty\}/);
  const clearCart = posApp.split("function clearCart()")[1]?.slice(0, 120) ?? "";
  assert.match(clearCart, /setCart\(\{\}\)/);
  assert.doesNotMatch(clearCart, /post\(|fetch\(|cashout\(/);
  assert.match(posApp, /data-testid="pos-deposit"/);
  assert.match(posApp, /\+Deposit/);
  assert.match(posApp, /MENU QR/);
  assert.doesNotMatch(posApp, /Customer QR/);
  assert.match(posApp, /PROMO COMING/);
  assert.match(posApp, /categoryChipLabel/);
  assert.match(posApp, /opening-jump/);
  const posHeader = posApp.split("posHeader")[1]?.split("</header>")[0] ?? "";
  const nameRow = posHeader.split("headerActions")[0] ?? "";
  const actionRow = posHeader.split("headerActions")[1] ?? "";
  assert.match(nameRow, /data-testid="customer-qr"/);
  assert.match(nameRow, /data-testid="tickets-tab"/);
  assert.doesNotMatch(actionRow, /customer-qr|tickets-tab/);
  const refillAt = actionRow.indexOf('data-testid="pos-refill"');
  const summaryAt = actionRow.indexOf('data-testid="pos-summary"');
  const tillAt = actionRow.indexOf('data-testid="open-till"');
  const endAt = actionRow.indexOf("End Shift");
  const depositAt = actionRow.indexOf('data-testid="pos-deposit"');
  assert.ok(refillAt >= 0 && refillAt < summaryAt && summaryAt < tillAt && tillAt < endAt && endAt < depositAt);
  assert.match(readFileSync("app/pos/till.module.css", "utf8"), /\.tillLink \{[^}]*background:\s*#166534/);
  assert.match(readFileSync("app/pos/till.module.css", "utf8"), /\.posHeader \.headerActions \{[^}]*flex-wrap:\s*nowrap/);
  assert.match(posApp, /deposits\/confirm-pin/);
  assert.doesNotMatch(posApp, /data-testid="cash-on-hand"|data-testid="total-deposited"|data-testid="total-sales"/);
  const customerQr = readFileSync("app/pos/CustomerQr.tsx", "utf8");
  assert.match(customerQr, /customerMenuQr/);
  assert.match(readFileSync("app/pos/menuQr.ts", "utf8"), /https:\/\/www\.p60cannabis\.com\/menu/);
  assert.match(readFileSync("app/pos/menuQr.ts", "utf8"), /from "uqr"/);
  assert.doesNotMatch(customerQr + readFileSync("app/pos/menuQr.ts", "utf8"), /qrserver|chart\.googleapis|api\.qr/);
  const qr = customerMenuQr();
  assert.equal(CUSTOMER_MENU_URL, "https://www.p60cannabis.com/menu");
  assert.equal(qr.data.length, qr.size);
  assert.equal(qr.data[0]?.length, qr.size);
  assert.equal(qr.data.some((row) => row.some(Boolean)), true);
  assert.match(tillApp, /data-testid="total-sales"/);
  assert.match(tillApp, /data-testid="cash-on-hand"/);
  assert.match(tillApp, /\+Deposit/);
  assert.match(tillApp, />Back</);
  assert.match(menuApp, /listRow/);
  assert.match(menuApp, /data-size=/);
  assert.match(menuApp, /bagLabel/);
  assert.equal(bagLabel("313-5g"), "6g");
  assert.equal(bagLabel("490-5g"), "6g");
  assert.equal(bagLabel("593-5g"), "6g");
  assert.equal(bagLabel("202-5g"), "5g");
  assert.equal(bagLabel("313-3g"), "3g");
  assert.match(menuApp, /aria-label="Categories"/);
  assert.match(menuApp, /defaultCategory/);
  assert.doesNotMatch(menuApp, /\["All"/);
  assert.match(posApp, /posDefaultCategory/);
  assert.doesNotMatch(posApp, /\["All"/);
  assert.doesNotMatch(menuApp, /Prices include tax/);
  assert.doesNotMatch(menuApp, /on_hand|item\.qty|product\.qty/);
  const menuCss = readFileSync("app/menu/menu.module.css", "utf8");
  const posCss = readFileSync("app/pos/till.module.css", "utf8");
  assert.match(menuCss, /grid-template-columns:\s*1fr 1fr/);
  assert.match(menuCss, /\.chipRows\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(menuCss, /\.chipRow\s*\{[^}]*display:\s*flex/s);
  assert.match(menuApp, /categoryChipLabel/);
  assert.match(posCss, /\.chips\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.doesNotMatch(menuCss, /\.chips\s*\{[^}]*overflow-x:\s*auto/s);
  assert.doesNotMatch(posCss, /\.chips\s*\{[^}]*overflow-x:\s*auto/s);
  assert.equal(hideMobileBottomBar("/hours"), false);
  assert.match(SCHEMA_SQL, /CHECK \(qty >= 0\)/);
  assert.match(SCHEMA_SQL, /OPENING_BALANCE|INCOMING_CONFIRM|COUNT_VARIANCE/);
  const vercel = readFileSync("vercel.json", "utf8");
  assert.match(vercel, /staff-photo\/maintenance\/cleanup/);
  assert.match(vercel, /\/api\/cron\/sheet-import/);
});

test("24. daily reconciliation matches the ledger and cash on hand", async () => {
  const h = await readyTill();
  await h.svc.cashout(h.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] });
  await h.svc.deposit(h.token, { key: "drop", amount_cents: 300 });
  await h.svc.voidSale(h.admin, { key: "void", sale_id: h.db.state.sales[0]!.id, reason: "undo" });
  await h.svc.adjust(h.admin, { key: "adj", sku: "1002", qty_delta: -1, reason: "sample" });
  const report = await h.svc.reconciliation();
  assert.equal(report.ok, true);
  assert.equal(report.cash_ok, true);
});

test("25. an admin void restores stock and is final; staff cannot void", async () => {
  const h = await readyTill({ "1001": 1, "1002": 0 });
  const sale = await h.svc.cashout(h.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(qty(h.db, "1001"), 0);
  await rejects(() => h.svc.voidSale(h.token, { key: "nope", sale_id: String(sale.sale_id), reason: "staff" }), "ADMIN_ONLY");
  assert.equal(qty(h.db, "1001"), 0);
  await h.svc.voidSale(h.admin, { key: "void", sale_id: String(sale.sale_id), reason: "wrong jar" });
  assert.equal(qty(h.db, "1001"), 1);
  await rejects(() => h.svc.voidSale(h.admin, { key: "void-2", sale_id: String(sale.sale_id), reason: "again" }), "VOID_FINAL");
  assert.equal(qty(h.db, "1001"), 1);
});

test("27. end shift says the summary posts within 5 min and admin flags a missed SCCx ack after 15 min", async () => {
  const h = await readyTill();
  const view = await h.svc.state(h.token);
  await submitClosingValues(h.svc, h.token);
  const ended = await h.svc.endShiftFromPos(h.token, { key: "end", lines: view.count_lines.map((line) => ({ sku: line.sku, counted_qty: line.system_qty })) });
  assert.equal(ended.message, "Summary will post to BOT HUB within 5 min.");
  h.clock.t = new Date(h.clock.t.getTime() + 10 * 60 * 1000);
  const early = await h.svc.adminState(h.admin);
  assert.equal(early.sccx_not_acked, false);
  h.clock.t = new Date(h.clock.t.getTime() + 6 * 60 * 1000);
  const late = await h.svc.adminState(h.admin);
  assert.equal(late.sccx_not_acked, true);
  assert.match(SCHEMA_SQL, /sccx_ack_at/);
});

test("the till uses the PNY sheet and ignores a Postgres URL", () => {
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    PNY_POS_DEMO: process.env.PNY_POS_DEMO,
    VERCEL_ENV: process.env.VERCEL_ENV,
    STORE_CODE: process.env.STORE_CODE,
    POS_STATE_BACKEND: process.env.POS_STATE_BACKEND,
    GSHEET_ID: process.env.GSHEET_ID,
    GOOGLE_SA_PNY_CLIENT_EMAIL: process.env.GOOGLE_SA_PNY_CLIENT_EMAIL,
    GOOGLE_SA_PNY_PRIVATE_KEY: process.env.GOOGLE_SA_PNY_PRIVATE_KEY,
  };
  const runtime = readFileSync("app/lib/pny-pos/runtime.ts", "utf8");
  assert.doesNotMatch(runtime, /process\.env\.DATABASE_URL|new PgDb/);
  assert.equal(sheetWriteAllowed("Items_raw_price"), false);
  assert.equal(sheetWriteAllowed("Products"), false);
  assert.equal(sheetWriteAllowed("S_Stock"), false);
  assert.equal(sheetWriteAllowed("SETB_Inventory"), false);
  assert.equal(sheetWriteAllowed("POS_Sales"), true);
  assert.equal(sheetWriteAllowed("Flowers_Raw"), false);
  assert.equal(sheetWriteAllowed("Items_Raw"), false);
  try {
    delete process.env.DATABASE_URL;
    delete process.env.PNY_POS_DEMO;
    delete process.env.STORE_CODE;
    delete process.env.POS_STATE_BACKEND;
    delete process.env.GSHEET_ID;
    delete process.env.GOOGLE_SA_PNY_CLIENT_EMAIL;
    delete process.env.GOOGLE_SA_PNY_PRIVATE_KEY;
    process.env.VERCEL_ENV = "preview";
    assert.equal(demoMode(), true);
    process.env.VERCEL_ENV = "production";
    assert.equal(demoMode(), true);
    process.env.DATABASE_URL = "postgres://production.example/pny";
    assert.equal(demoMode(), true);
    process.env.GSHEET_ID = "sheet";
    process.env.GOOGLE_SA_PNY_CLIENT_EMAIL = "sa@example.com";
    process.env.GOOGLE_SA_PNY_PRIVATE_KEY = "key";
    assert.equal(demoMode(), false);
    process.env.PNY_POS_DEMO = "0";
    delete process.env.GSHEET_ID;
    assert.equal(demoMode(), false);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("the till PIN check keeps the POS session and leaves the shift alone", async () => {
  const h = await readyTill({ "1001": 4 });
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  const hash = shift.pin_hash;
  const opened = shift.verify_opened_at;
  const sessions = h.db.state.sessions.length;
  const sales = JSON.stringify(h.db.state.sales);
  const balances = JSON.stringify(h.db.state.balances);
  const counts = JSON.stringify(h.db.state.closing_drafts ?? []);
  const staff = await h.svc.unlockTill(h.token, h.pin);
  assert.equal(staff.view_only, false);
  const kept = h.db.state.shifts.find((row) => row.id === shift.id);
  assert.equal(h.db.state.sessions.length, sessions);
  assert.equal(kept?.pin_hash, hash);
  assert.equal(kept?.verify_opened_at, opened);
  assert.equal(kept?.pin_failed_attempts, 0);
  assert.equal(JSON.stringify(h.db.state.sales), sales);
  assert.equal(JSON.stringify(h.db.state.balances), balances);
  assert.equal(JSON.stringify(h.db.state.closing_drafts ?? []), counts);
  await rejects(() => h.svc.unlockTill(h.token, "0000"), "BAD_PIN");
  const afterMiss = h.db.state.shifts.find((row) => row.id === shift.id);
  assert.equal(afterMiss?.pin_failed_attempts, 1);
  assert.equal(afterMiss?.pin_hash, hash);
  const again = await h.svc.unlockTill(h.token, h.pin);
  assert.equal(again.view_only, false);
  assert.equal(h.db.state.shifts.find((row) => row.id === shift.id)?.pin_failed_attempts, 0);
  const asMaster = await h.svc.unlockTill(h.token, "1988");
  assert.equal(asMaster.view_only, true);
  const still = await h.svc.state(h.token);
  assert.equal(still.master, false);
  assert.equal(still.can_sell, true);
  assert.equal(h.db.state.sessions.length, sessions);
  const master = await h.svc.login("1988", "10.9.0.1");
  const masterView = await h.svc.unlockTill(master.token, "1988");
  assert.equal(masterView.view_only, true);
  const staffPinOnMaster = await h.svc.unlockTill(master.token, h.pin);
  assert.equal(staffPinOnMaster.view_only, true);
  await rejects(() => h.svc.deposit(master.token, { key: "master-till", amount_cents: 100 }), "MASTER_VIEW");
  assert.equal(shift.pin_hash, hash);
  const tillApp = readFileSync("app/pos/till/TillApp.tsx", "utf8");
  assert.match(tillApp, /apiBase = "\/api\/pos"/);
  assert.match(tillApp, /\$\{storeApi\}\/till\/unlock/);
  assert.match(tillApp, /data-testid="pos-till-gate"/);
  assert.match(tillApp, /data-testid="till-unlock"/);
});

test("the sales feed returns new sales once and does not change the till", async () => {
  const h = await readyTill({ "1001": 5, "1002": 5 });
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  const hash = shift.pin_hash;
  const order = await h.svc.placeOrder({ key: "feed-ticket", lines: [{ sku: "1001", qty: 1 }] }, "10.6.0.1");
  const ticket = (await h.svc.state(h.token)).tickets.find((row) => row.code === order.code);
  assert.ok(ticket);
  await h.svc.cashout(h.token, { key: "feed-cash", payment_method: "CASH", ticket_id: ticket.id, lines: ticket.lines.map((line) => ({ sku: line.sku, qty: line.qty })) });
  await h.svc.cashout(h.token, { key: "feed-debit", payment_method: "DEBIT", lines: [{ sku: "1002", qty: 2 }] });
  const balances = JSON.stringify(h.db.state.balances);
  const sales = JSON.stringify(h.db.state.sales);
  const boot = await h.svc.salesFeed(null);
  assert.equal(boot.bootstrap, true);
  assert.equal(boot.sales.length, 0);
  assert.equal(boot.store, "PNY01");
  const page = await h.svc.salesFeed("0");
  assert.equal(page.sales.length, 2);
  const cash = page.sales.find((row) => row.payment === "cash");
  const debit = page.sales.find((row) => row.payment === "debit");
  assert.ok(cash && debit);
  assert.equal(cash.ticket_no, order.code);
  assert.equal(cash.store, "PNY01");
  assert.equal(cash.staff_name.length > 0, true);
  assert.equal(cash.items[0]?.qty, 1);
  assert.equal(typeof cash.items[0]?.size, "string");
  assert.equal(debit.items[0]?.qty, 2);
  assert.equal(debit.ticket_no, null);
  assert.equal(page.sales[0]?.shift_order_number, 1);
  assert.equal(page.sales[1]?.shift_order_number, 2);
  assert.equal(page.sales[0]?.shift_total_cents, page.sales[0]?.total_cents);
  assert.equal(
    page.sales[1]?.shift_total_cents,
    (page.sales[0]?.total_cents ?? 0) + (page.sales[1]?.total_cents ?? 0),
  );
  const repeat = await h.svc.salesFeed("0");
  assert.deepEqual(repeat.sales.map((row) => row.id), page.sales.map((row) => row.id));
  const second = await h.svc.salesFeed(`${page.sales[0]?.at}|${page.sales[0]?.id}`);
  assert.equal(second.sales.length, 1);
  assert.equal(second.sales[0]?.id, page.sales[1]?.id);
  const done = await h.svc.salesFeed(second.next_cursor);
  assert.equal(done.sales.length, 0);
  assert.equal(done.next_cursor, second.next_cursor);
  assert.equal(JSON.stringify(h.db.state.balances), balances);
  assert.equal(JSON.stringify(h.db.state.sales), sales);
  assert.equal(h.db.state.shifts.find((row) => row.id === shift.id)?.pin_hash, hash);
  const savedToken = process.env.SALES_FEED_TOKEN;
  process.env.SALES_FEED_TOKEN = "feed-test-token";
  try {
    assert.equal(salesFeedTokenOk("feed-test-token"), true);
    assert.equal(salesFeedTokenOk("other-token"), false);
    assert.equal(salesFeedTokenOk(null), false);
    delete process.env.SALES_FEED_TOKEN;
    assert.equal(salesFeedTokenOk("feed-test-token"), false);
  } finally {
    if (savedToken == null) delete process.env.SALES_FEED_TOKEN;
    else process.env.SALES_FEED_TOKEN = savedToken;
  }
});

test("the open shift is shown as Anom and a deposit keeps the same PIN", async () => {
  const h = await readyTill({ "1001": 2 });
  const shift = h.db.state.shifts.find((row) => row.status === "ACTIVE");
  const hash = shift?.pin_hash ?? "";
  const view = await h.svc.state(h.token);
  assert.equal(view.shift?.staff_name, "Anom");
  assert.equal(h.db.state.shifts.find((row) => row.id === shift?.id)?.pin_hash, hash);
  await rejects(() => h.svc.confirmShiftPin(h.token, "0000"), "BAD_PIN");
  assert.equal(h.db.state.shifts.find((row) => row.id === shift?.id)?.pin_hash, hash);
  await h.svc.confirmShiftPin(h.token, h.pin);
  assert.equal(h.db.state.shifts.find((row) => row.id === shift?.id)?.pin_hash, hash);
  await h.svc.cashout(h.token, { key: "cash-for-deposit", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }] });
  const saved = await h.svc.deposit(h.token, { key: "mid-deposit", amount_cents: 400 });
  assert.equal(saved.deposited_cents, 400);
  assert.equal(h.db.state.deposits.at(-1)?.amount_cents, 400);
  const next = await h.svc.startShift({ key: "start-b", store: "PNY01", staff_ref: "staff-b", shift_id: "sccx-b" });
  const login = await h.svc.login(String(next.pin), "10.0.0.77");
  const again = await h.svc.state(login.token);
  assert.equal(again.shift?.staff_name, "Bea");
});

test("a single recent debit test sale is removed and its stock comes back", async () => {
  const h = await readyTill({ "1001": 2 });
  h.clock.t = new Date("2026-11-04T01:30:00.000Z");
  await h.svc.cashout(h.token, { key: "test-debit", payment_method: "DEBIT", lines: [{ sku: "1001", qty: 1 }] });
  const sale = h.db.state.sales.find((row) => row.payment_method === "DEBIT");
  assert.ok(sale);
  h.sheet.tabs.POS_Sales = [{ row_id: sale.id, payment_method: "DEBIT", total_cents: "1000", status: "COMPLETED" }];
  assert.equal(qty(h.db, "1001"), 1);
  const removed = await h.svc.removeTestDebit(h.token);
  assert.equal(removed.removed, true);
  if (!removed.removed) return;
  assert.equal(removed.sale?.total_cents, 1000);
  assert.equal(removed.sale?.lines[0]?.sku, "1001");
  assert.equal(removed.sale?.lines[0]?.qty, 1);
  assert.equal(removed.debit_sales_cents, 0);
  assert.equal(qty(h.db, "1001"), 2);
  assert.equal(h.db.state.sales.some((row) => row.id === sale.id), false);
  assert.equal(h.sheet.tabs.POS_Sales.some((row) => row.row_id === sale.id), false);

  h.clock.t = new Date("2026-11-04T01:31:00.000Z");
  await h.svc.cashout(h.token, { key: "debit-a", payment_method: "DEBIT", lines: [{ sku: "1001", qty: 1 }] });
  h.clock.t = new Date("2026-11-04T01:32:00.000Z");
  await h.svc.cashout(h.token, { key: "debit-b", payment_method: "DEBIT", lines: [{ sku: "1001", qty: 1 }] });
  const before = h.db.state.sales.filter((row) => row.status === "COMPLETED").length;
  const held = await h.svc.removeTestDebit(h.token);
  assert.equal(held.removed, false);
  if (held.removed) return;
  assert.equal(held.candidates.length, 2);
  assert.equal(h.db.state.sales.filter((row) => row.status === "COMPLETED").length, before);
});

test("today's summary is read-only and copies plain text without stock or variance", async () => {
  const h = await readyTill({ "1001": 4, "1002": 2 });
  await h.svc.cashout(h.token, { key: "sum-cash", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }] });
  await h.svc.cashout(h.token, { key: "sum-debit", payment_method: "DEBIT", lines: [{ sku: "1002", qty: 1 }] });
  await h.svc.deposit(h.token, { key: "sum-dep", amount_cents: 200 });
  const hash = h.db.state.shifts.find((row) => row.status === "ACTIVE")?.pin_hash;
  const salesBefore = h.db.state.sales.length;
  const stockBefore = qty(h.db, "1001");
  const summary = await h.svc.shiftSummary(h.token);
  assert.match(summary.text, /PNY01/);
  assert.match(summary.text, /Anom/);
  assert.match(summary.text, /Cash: \$10\.00/);
  assert.match(summary.text, /Debit: \$5\.00/);
  assert.match(summary.text, /Deposits: \$2\.00/);
  assert.match(summary.text, /Grand total: \$15\.00/);
  assert.match(summary.text, /1 × Flower/);
  assert.doesNotMatch(summary.text, /variance|on_hand|system_qty|shortage/i);
  assert.equal(h.db.state.sales.length, salesBefore);
  assert.equal(qty(h.db, "1001"), stockBefore);
  assert.equal(h.db.state.shifts.find((row) => row.status === "ACTIVE")?.pin_hash, hash);
  assert.match(readFileSync("app/pos/PosApp.tsx", "utf8"), /data-testid="pos-summary"/);
  assert.doesNotMatch(readFileSync("app/pos/PosApp.tsx", "utf8").split('data-testid="pos-summary"')[1]?.slice(0, 80) ?? "", /\$|formatMoney/);
});

test("sheet store keeps a hashed shift PIN, refill opening count, and cash or debit sales", async () => {
  const pin = "2468";
  const sheet = new LocalSheet();
  const db = new SheetDb(sheet);
  const svc = new PosService(db, { sheet, secrets, demo: null });
  await svc.syncSetb([
    { sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true },
    { sku: "1002", name: "Gummy", category: "Edible", price_cents: 500, active: true },
  ]);
  const opened = await svc.openShiftWithPin({ staff_uid: "staff-tri", display_name: "Tri", pos_id: "TRI", shift_id: "pny01-tri-today", pin });
  assert.equal(opened.ok, true);
  assert.equal("pin" in opened, false);
  const login = await svc.login(pin, "10.0.0.8");
  await svc.answerWeedInStore(login.token, true);
  const refillId = crypto.randomUUID();
  sheet.tabs.POS_Refills.push({
    row_id: refillId,
    store_code: "PNY01",
    sku: "1001",
    qty: "2",
    kind: "REFILL",
    kitchen_status: "ACTIVE",
    created_at: "2026-11-03T18:00:00.000Z",
  });
  db.forgetCache();
  const opening = await svc.state(login.token);
  assert.equal(opening.phase, "sell");
  assert.equal(opening.products.find((product) => product.sku === "1001")?.qty ?? 0, 0);
  await svc.confirmIncoming(login.token, { key: "receive-sheet", lines: [{ kitchen_row_id: refillId, qty_received: 2 }] });
  assert.equal((await svc.state(login.token)).products.find((product) => product.sku === "1001")?.qty, 2);
  const cash = await svc.cashout(login.token, { key: "cash-sheet", lines: [{ sku: "1001", qty: 1 }], payment_method: "CASH" });
  const debit = await svc.cashout(login.token, { key: "debit-sheet", lines: [{ sku: "1001", qty: 1 }], payment_method: "DEBIT" });
  assert.equal(cash.payment_method, "CASH");
  assert.equal(debit.payment_method, "DEBIT");
  const again = new SheetDb(sheet);
  const live = new PosService(again, { sheet, secrets, demo: null });
  const relog = await live.login(pin, "10.2.0.8");
  const view = await live.state(relog.token);
  assert.equal(view.shift.staff_name, "Anom");
  assert.equal(sheet.tabs.POS_Staff.find((row) => row.staff_uid === "staff-tri")?.display_name, "Anom");
  assert.equal(view.totals.cash_sales_cents, 1000);
  assert.equal(view.totals.debit_sales_cents, 1000);
  assert.equal(view.products.find((product) => product.sku === "1001")?.qty, 0);
  const stored = JSON.stringify(sheet.tabs);
  assert.equal(stored.includes(`"${pin}"`), false);
  assert.match(sheet.tabs.POS_Shifts[0]?.pin_hash ?? "", /^scrypt\$/);
  assert.equal(sheet.tabs.POS_Sales.map((row) => row.payment_method).sort().join(","), "CASH,DEBIT");
  assert.equal(sheet.tabs.POS_Refills[0]?.status, "CONFIRMED");
  const status = await live.openShiftStatus();
  assert.equal(status.active, true);
  assert.equal(status.open_by, "Anom");
  await rejects(() => live.openShiftWithPin({ staff_uid: "staff-other", display_name: "Other", pin: "1357" }), "TILL_OPEN");
  const stillOpen = await live.login(pin, "10.0.0.9");
  assert.equal(stillOpen.staff_name, "Anom");
  assert.equal(sheet.tabs.POS_Staff.some((row) => row.staff_uid === "staff-other"), false);
});

test("SETB feed mapping keeps real SKUs and images and drops on-hand", () => {
  const rows = catalogFromFeed({
    flowers: [{ sku: "490", name: "PINK JOKER", tier: "PREMIUM", price3g: { regular: 30, sale: null }, price5g: { regular: 45, sale: 40 }, image: "https://cdn.example/pink.webp", on_hand: 99, qty: 4 }],
    items: [
      { sku: "613, 614", name: "STELLAR GUMMIES", category: "EDIBLES", price: "$40 / $55", image: "https://cdn.example/stellar.webp", stock: 12 },
      { sku: "392", name: "SECOND", tier: "BUDGET", price5g: { regular: 10, sale: null }, image: "https://cdn.example/second.webp" },
    ],
  });
  const three = rows.find((row) => row.sku === "490-3g");
  const five = rows.find((row) => row.sku === "490-5g");
  assert.equal(three?.name, "PINK JOKER 3g");
  assert.equal(three?.price_cents, 3000);
  assert.equal(five?.name, "PINK JOKER 5g");
  assert.equal(five?.price_cents, 4000);
  assert.equal(three?.image_url, "https://cdn.example/pink.webp");
  assert.equal(three?.category, "PREMIUM");
  assert.equal(rows.some((row) => row.sku === "490"), false);
  assert.equal(rows.filter((row) => row.sku === "392-5g").length, 1);
  assert.equal(rows.find((row) => row.sku === "392-5g")?.price_cents, 1000);
  assert.deepEqual(rows.filter((row) => row.sku === "613" || row.sku === "614").map((row) => row.price_cents), [4000, 5500]);
  assert.equal(JSON.stringify(rows).includes("on_hand"), false);
  assert.equal(JSON.stringify(rows).includes("\"stock\""), false);
  const committed = catalogFromFeed(readCommittedPnyCatalog());
  assert.ok(committed.some((row) => row.sku === "490-3g" && row.name === "PINK JOKER 3g" && row.image_url?.startsWith("https://")));
  const tv = readFileSync("app/lib/tvStock.js", "utf8");
  assert.match(tv, /AKfycbx09_sDal1eMVF1r-hUck4e7oq_XBHEWhGvA79JuhZNQ6P4CdhCas0xE3FfexWQ3hq4/);
  assert.equal(DEFAULT_SETB_PRODUCTS_URL.includes("store=PNY01"), true);
  assert.equal(DEFAULT_SETB_PRODUCTS_URL.includes("AKfycbx09_sDal1eMVF1r-hUck4e7oq_XBHEWhGvA79JuhZNQ6P4CdhCas0xE3FfexWQ3hq4"), true);
});

test("demo PIN 6666 is a signed session that another server accepts", async () => {
  assert.equal(DEMO_PIN, "6666");
  assert.match(DEMO_PIN, /^\d{4}$/);
  const now = new Date("2026-11-03T15:00:00.000Z");
  const make = () => {
    const db = new MemoryDb();
    applyDemoSeed(db.state, now);
    const svc = new PosService(db, { now: () => now, sheet: new LocalSheet(), secrets, demo: { pin: DEMO_PIN, label: "DEMO DATA" } });
    return { db, svc };
  };
  const first = make();
  const second = make();
  const login = await first.svc.login(DEMO_PIN, "10.9.9.1");
  assert.match(login.token, /^v1\./);
  const remote = await second.svc.state(login.token);
  assert.equal(remote.shift?.pos_id, "DEMO1");
  assert.ok((remote.products?.length ?? 0) > 0);
  await rejects(() => second.svc.login("1234", "10.9.9.2"), "BAD_PIN");
  await rejects(() => second.svc.state(`${login.token}x`), "SESSION_REJECTED");
  second.db.state.shifts.forEach((shift) => {
    shift.status = "ENDED";
    shift.pin_hash = null;
  });
  const again = await second.svc.login(DEMO_PIN, "10.9.9.3");
  assert.equal((await second.svc.state(again.token)).shift?.status, "ACTIVE");
  process.env.VERCEL_ENV = "production";
  try {
    second.db.state.shifts.forEach((shift) => {
      shift.status = "ENDED";
      shift.pin_hash = null;
    });
    const live = await second.svc.login(DEMO_PIN, "10.9.9.4");
    assert.equal((await second.svc.state(live.token)).shift?.status, "ACTIVE");
  } finally {
    delete process.env.VERCEL_ENV;
  }
});

test("demo seed is labeled, reconciles, and the menu shows real SETB products with images", async () => {
  const db = new MemoryDb();
  const now = new Date("2026-11-03T15:00:00.000Z");
  applyDemoSeed(db.state, now);
  const sheet = new LocalSheet();
  const svc = new PosService(db, { now: () => now, sheet, secrets, demo: { pin: DEMO_PIN, label: "DEMO DATA — real SETB products, sample stock, not live on-hand" } });
  const report = await svc.reconciliation();
  assert.equal(report.ok, true);
  const menu = await svc.menu();
  assert.equal(menu.demo, true);
  assert.ok((menu.items?.length ?? 0) > 20);
  assert.equal(menu.items?.some((item) => item.sku === "490-3g" && item.name === "PINK JOKER 3g"), true);
  assert.equal(menu.items?.every((item) => item.availability === "Available" && typeof item.image_url === "string" && item.image_url.length > 0), true);
  const packs = menu.items?.filter((item) => item.category === "CIGARETTES" && Number(item.sku) >= 1000 && Number(item.sku) <= 1027) ?? [];
  assert.equal(packs.length > 0, true);
  assert.equal(packs.every((item) => item.price_cents === 250 && item.unit_label === "per pack"), true);
  assert.equal(keysDeep(menu).has("qty"), false);
  assert.equal(keysDeep(menu).has("on_hand"), false);
  const login = await svc.login(DEMO_PIN, "10.0.0.1");
  const state = await svc.state(login.token);
  assert.equal(state.pending_count, 2);
  assert.ok((state.totals?.sales_cents ?? 0) >= 500);
  assert.equal(state.totals?.deposited_cents, 500);
  assert.equal(state.totals?.cash_on_hand_cents, (state.totals?.sales_cents ?? 0) - 500);
  assert.equal(state.products?.some((product) => product.image_url?.startsWith("https://")), true);
  assert.equal(db.state.ledger.filter((row) => row.movement_type === "OPENING_BALANCE").every((row) => row.reason === "DEMO stock, not SETB on-hand"), true);
});

test("kitchen send adds allocation or refill stock once and does not write the public catalog", async () => {
  const h = await readyTill({ "1001": 2, "1002": 1 });
  const before = qty(h.db, "1001");
  const refill = { key: "refill-1", kind: "REFILL" as const, lines: [{ sku: "1001", qty: 3 }, { sku: "1002", qty: 0 }] };
  await h.svc.sendRefill(h.token, refill);
  assert.equal(h.db.state.incoming.filter((row) => row.kind === "REFILL").length, 1);
  assert.equal(qty(h.db, "1001"), before + 3);
  assert.equal(qty(h.db, "1002"), 1);
  assert.equal(h.db.state.incoming[0]?.kind, "REFILL");
  assert.equal(h.db.state.incoming[0]?.status, "CONFIRMED");
  await h.svc.sendRefill(h.token, refill);
  assert.equal(qty(h.db, "1001"), before + 3);
  await h.svc.sendRefill(h.token, { key: "alloc-1", kind: "ALLOCATION", lines: [{ sku: "1002", qty: 4 }] });
  assert.equal(qty(h.db, "1002"), 5);
  assert.equal(h.db.state.incoming.find((row) => row.sku === "1002")?.kind, "ALLOCATION");
  const state = await h.svc.state(h.token);
  assert.equal(state.receipts.length, 2);
  await rejects(() => h.svc.sendRefill(h.token, { key: "empty", lines: [] }), "EMPTY");
  assert.equal(existsSync("app/api/kitchen/refill/route.ts"), false);
});

test("cashing a ticket marks it paid once and a fresh demo server keeps that close", async () => {
  const h = await readyTill({ "1001": 4, "1002": 4 });
  const order = await h.svc.placeOrder({ key: "order-pay", lines: [{ sku: "1001", qty: 1 }] }, "10.8.0.1");
  const ticket = (await h.svc.state(h.token)).tickets.find((row) => row.code === order.code);
  assert.ok(ticket);
  const beforeSales = h.db.state.sales.length;
  const beforeQty = qty(h.db, "1001");
  const paid = await h.svc.cashout(h.token, {
    key: "pay-1",
    ticket_id: ticket.id,
    lines: ticket.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
  });
  assert.equal(h.db.state.tickets.find((row) => row.id === ticket.id)?.status, "CASHED_OUT");
  assert.equal((await h.svc.state(h.token)).tickets.some((row) => row.id === ticket.id), false);
  assert.equal(qty(h.db, "1001"), beforeQty - 1);
  const again = await h.svc.cashout(h.token, {
    key: "pay-2",
    ticket_id: ticket.id,
    lines: ticket.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
  });
  assert.equal(again.sale_id, paid.sale_id);
  assert.equal(h.db.state.sales.length, beforeSales + 1);
  assert.equal(qty(h.db, "1001"), beforeQty - 1);
  const customer = await h.svc.ticketStatus(ticket.code);
  assert.equal(customer.status, "PAID");
  assert.equal(customer.paid, true);

  const now = new Date("2026-11-03T15:00:00.000Z");
  const make = () => {
    const db = new MemoryDb();
    applyDemoSeed(db.state, now);
    const svc = new PosService(db, { now: () => now, sheet: new LocalSheet(), secrets, demo: { pin: DEMO_PIN, label: "DEMO DATA" } });
    return { db, svc };
  };
  const origin = make();
  const login = await origin.svc.login(DEMO_PIN, "10.8.1.1");
  const open = (await origin.svc.state(login.token)).tickets[0];
  assert.ok(open);
  const seededSales = (await origin.svc.state(login.token)).totals?.sales_cents ?? 0;
  const closed = await origin.svc.cashout(login.token, {
    key: "demo-pay",
    ticket_id: open.id,
    lines: open.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
  });
  const journal = closed.journal_order ? [closed.journal_order] : [];
  assert.equal(journal.length, 1);
  const warm = await origin.svc.state(login.token, journal);
  assert.equal(warm.tickets.some((row) => row.id === open.id), false);
  assert.equal(warm.totals?.sales_cents, seededSales + closed.total_cents);
  const cold = make();
  const other = await cold.svc.login(DEMO_PIN, "10.8.1.2");
  const reloaded = await cold.svc.state(other.token, journal);
  assert.equal(reloaded.tickets.some((row) => row.id === open.id), false);
  assert.equal(reloaded.totals?.sales_cents, warm.totals?.sales_cents);
  const second = await cold.svc.cashout(other.token, {
    key: "demo-pay-again",
    ticket_id: open.id,
    lines: open.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
  }, journal);
  assert.equal(second.sale_id, closed.sale_id);
  assert.equal((await cold.svc.state(other.token, journal)).totals?.sales_cents, warm.totals?.sales_cents);
  assert.equal((await cold.svc.ticketStatus(open.code, journal)).status, "PAID");
});

test("kitchen PIN 9999 opens the kitchen and the POS PIN 6666 does not", async () => {
  assert.equal(KITCHEN_PIN, "9999");
  assert.notEqual(KITCHEN_PIN, DEMO_PIN);
  const now = new Date("2026-11-03T15:00:00.000Z");
  const make = () => {
    const db = new MemoryDb();
    applyDemoSeed(db.state, now);
    const svc = new PosService(db, { now: () => now, sheet: new LocalSheet(), secrets, demo: { pin: DEMO_PIN, label: "DEMO DATA" } });
    return svc;
  };
  const svc = make();
  await rejects(() => svc.kitchenLogin(DEMO_PIN, "10.7.0.1"), "BAD_PIN");
  await rejects(() => svc.kitchenLogin("12345", "10.7.0.2"), "BAD_PIN");
  const kitchen = await svc.kitchenLogin(KITCHEN_PIN, "10.7.0.3");
  assert.match(kitchen.token, /^v1\./);
  const view = await svc.state(kitchen.token, undefined, "kitchen");
  assert.equal(view.shift?.pos_id, "DEMO1");
  await rejects(() => svc.state(kitchen.token), "SESSION_REJECTED");
  const pos = await svc.login(DEMO_PIN, "10.7.0.4");
  assert.equal((await svc.state(pos.token)).shift?.pos_id, "DEMO1");
  await rejects(() => svc.state(pos.token, undefined, "kitchen"), "SESSION_REJECTED");
  await rejects(() => svc.login(KITCHEN_PIN, "10.7.0.5"), "BAD_PIN");

  const locker = make();
  for (let attempt = 0; attempt < 4; attempt += 1) await rejects(() => locker.kitchenLogin("0000", "10.7.1.1"), "BAD_PIN");
  await rejects(() => locker.kitchenLogin("0000", "10.7.1.2"), "LOCKED");
  await rejects(() => locker.kitchenLogin(KITCHEN_PIN, "10.7.1.3"), "LOCKED");
});

test("cash stays in the drawer and debit does not, and the close balance uses shortage and deposits", async () => {
  assert.deepEqual(lineVariance({ expected_qty: 3, counted_qty: 1, price_cents: 1000 }), {
    variance_qty: -2,
    shortage_qty: 2,
    overage_qty: 0,
    shortage_cents: 2000,
    overage_cents: 0,
  });
  assert.equal(closingBalance({ cash_sales_cents: 1000, shortage_cents: 1000, overage_cents: 500, deposited_cents: 400 }), 1100);

  const h = await readyTill({ "1001": 4, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "refill", store_code: "PNY01", kind: "REFILL", sku: "1002", qty: "2", created_at: "2026-11-03T16:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  await h.svc.confirmIncoming(h.token, { key: "receive", lines: [{ kitchen_row_id: rowId, qty_received: 2 }] });
  const cash = await h.svc.cashout(h.token, { key: "cash-sale", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }] });
  const debit = await h.svc.cashout(h.token, { key: "debit-sale", payment_method: "DEBIT", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(cash.payment_method, "CASH");
  assert.equal(debit.payment_method, "DEBIT");
  const mid = await h.svc.state(h.token);
  assert.equal(mid.totals?.sales_cents, 2000);
  assert.equal(mid.totals?.cash_sales_cents, 1000);
  assert.equal(mid.totals?.debit_sales_cents, 1000);
  assert.equal(mid.totals?.cash_on_hand_cents, 1000);
  const plan = mid.close_lines ?? [];
  assert.deepEqual(plan.map((line) => line.sku), ["1001", "1002"]);
  assert.equal(plan.find((line) => line.sku === "1001")?.expected_qty, 2);
  assert.equal(plan.find((line) => line.sku === "1002")?.expected_qty, 2);
  await h.svc.saveClosingCount(h.token, { sku: "1001", counted_qty: 1 });
  const saved = await h.svc.state(h.token);
  assert.equal(saved.close_lines?.find((line) => line.sku === "1001")?.counted_qty, 1);
  assert.equal(saved.close_lines?.find((line) => line.sku === "1002")?.counted_qty, null);
  await submitClosingValues(h.svc, h.token, { "1001": 1, "1002": 3 });
  const ended = await h.svc.endShiftFromPos(h.token, {
    key: "end-balance",
    final_deposit_cents: 400,
    lines: [
      { sku: "1001", counted_qty: 1 },
      { sku: "1002", counted_qty: 3 },
    ],
  });
  assert.equal(qty(h.db, "1001"), 1);
  assert.equal(qty(h.db, "1002"), 3);
  assert.equal(ended.closing.cash_sales_cents, 1000);
  assert.equal(ended.closing.debit_sales_cents, 1000);
  assert.equal(ended.closing.shortage_cents, 1000);
  assert.equal(ended.closing.overage_cents, 500);
  assert.equal(ended.closing.final_deposit_cents, 400);
  assert.equal(ended.closing.deposited_cents, 400);
  assert.equal(ended.closing.balance_cents, 1100);
  const summary = h.db.state.outbox.find((row) => row.tab === "S_ShiftSummary");
  assert.equal(summary?.payload.cash_sales, "10.00");
  assert.equal(summary?.payload.debit_sales, "10.00");
  assert.equal(summary?.payload.shortage, "10.00");
  assert.equal(summary?.payload.overage, "5.00");
  assert.equal(summary?.payload.balance, "11.00");
  const polled = await h.svc.closedShifts();
  assert.equal(polled.closings[0]?.cash_sales, 1000);
  assert.equal(polled.closings[0]?.debit_sales, 1000);
  assert.equal(polled.closings[0]?.balance, 1100);
  assert.equal(polled.closings[0]?.variance?.find((line) => line.sku === "1001")?.shortage_cents, 1000);
});

test("SKU 1000 rings the raw pack price with no tax and ignores the client price", async () => {
  assert.equal(unitPricesFromRawRows([{ SKU: "1000", Unit: "pack", Unit_Price: "$2.50", Carton_Price: "25", Packs_per_carton: "10", Needs_Review: "" }]).get("1000"), 250);
  assert.equal(cartonNote("25", "10"), "Carton $25 · 10 per carton");
  assert.equal(cartonNote("", ""), null);
  assert.equal(unitPricesFromRawRows([{ SKU: "1001", Unit_Price: "" }]).has("1001"), false);

  const h = await readyTill({ "1001": 2 });
  await h.svc.syncSetb([{ sku: "1000", name: "BB pack", category: "Cigarettes", price_cents: 999, active: true }]);
  await h.svc.openingBalance(h.admin, { key: "ob-1000", sku: "1000", qty: 20 });
  h.sheet.tabs.Items_raw_price = [
    { SKU: "1000", Unit: "pack", Unit_Price: "2.50", Carton_Price: "25", Packs_per_carton: "10", Needs_Review: "" },
    { SKU: "1001", Unit: "unit", Unit_Price: "", Carton_Price: "", Packs_per_carton: "", Needs_Review: "yes" },
  ];
  h.clock.t = new Date(h.clock.t.getTime() + 3 * 60 * 1000);
  const before = h.sheet.tabs.Items_raw_price.map((row) => ({ ...row }));
  let reads = 0;
  const readRows = h.sheet.readRows.bind(h.sheet);
  h.sheet.readRows = async (tab: string) => {
    if (tab === "Items_raw_price") reads += 1;
    return readRows(tab);
  };
  const writes: string[] = [];
  const upsert = h.sheet.upsert.bind(h.sheet);
  h.sheet.upsert = async (tab: string, rows: Record<string, string>[]) => {
    writes.push(tab);
    return upsert(tab, rows);
  };

  const pack = await h.svc.cashout(h.token, { key: "pack", payment_method: "CASH", lines: [{ sku: "1000", qty: 1, unit_price_cents: 1 }] });
  assert.equal(pack.total_cents, 250);
  assert.equal(pack.prices_tax_included, false);
  assert.equal(pack.lines[0]?.unit_price_cents, 250);
  const carton = await h.svc.cashout(h.token, { key: "carton", lines: [{ sku: "1000", qty: 10 }] });
  assert.equal(carton.total_cents, 2500);
  assert.equal(reads, 1);
  const menu = await h.svc.cashout(h.token, { key: "flower", lines: [{ sku: "1001", qty: 1, unit_price_cents: 1 }] });
  assert.equal(menu.total_cents, 1000);
  assert.equal(menu.prices_tax_included, true);
  const shown = await h.svc.state(h.token);
  assert.equal(shown.products?.find((product) => product.sku === "1000")?.price_cents, 250);
  h.clock.t = new Date(h.clock.t.getTime() + 3 * 60 * 1000);
  await h.svc.cashout(h.token, { key: "pack-again", lines: [{ sku: "1000", qty: 1 }] });
  assert.equal(reads, 2);
  assert.deepEqual(h.sheet.tabs.Items_raw_price, before);
  assert.equal(writes.includes("Items_raw_price"), false);
});

test("opening count is only stocked SKUs or an incoming refill, otherwise it waits for Kitchen", async () => {
  const h = harness();
  await h.svc.syncSetb([
    { sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true },
    { sku: "1002", name: "Empty", category: "Edible", price_cents: 500, active: true },
  ]);
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-a" });
  const login = await h.svc.login(String(started.pin), "10.2.0.1");
  await h.svc.answerWeedInStore(login.token, true);
  const waiting = await h.svc.state(login.token);
  assert.equal(waiting.phase, "sell");
  assert.equal(waiting.block, null);
  await rejects(() => h.svc.cashout(login.token, { key: "too-soon", lines: [{ sku: "1002", qty: 1 }] }), "OUT_OF_STOCK");

  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "refill", store_code: "PNY01", kind: "REFILL", sku: "1002", qty: "3", created_at: "2026-11-03T16:00:00+07:00", kitchen_status: "ACTIVE" }];
  await h.svc.refreshIncoming({ force: true });
  await h.svc.openingBalance(h.admin ?? (await h.svc.adminLogin(secrets.admin)).token, { key: "ob-1001", sku: "1001", qty: 4 });
  const admin = h.db.state.admin_sessions.length ? (await h.svc.adminLogin(secrets.admin)).token : "";
  if (!h.db.state.balances.some((row) => row.sku === "1001" && row.qty === 4)) {
    await h.svc.openingBalance(admin, { key: "ob-1001b", sku: "1001", qty: 4 });
  }
  const view = await h.svc.state(login.token);
  assert.equal(view.phase, "sell");
  assert.equal(qty(h.db, "1002"), 0);
  await h.svc.confirmIncoming(login.token, { key: "receive-1002", lines: [{ kitchen_row_id: rowId, qty_received: 3 }] });
  assert.equal(qty(h.db, "1002"), 3);
  assert.equal(qty(h.db, "1001"), 4);
});

test("TEST01 sheet store keeps deposits, the closing wizard, and till totals, then is wiped", async () => {
  const pin = "3579";
  const sheet = new LocalSheet();
  assert.equal(sheet.configured, false);
  const svc = new PosService(new SheetDb(sheet), { sheet, secrets, demo: null });
  await svc.syncSetb([{ sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true }]);
  const opened = await svc.openShiftWithPin({
    staff_uid: "staff-test01",
    display_name: "Test Till",
    pos_id: "TEST01",
    shift_id: "TEST01-close",
    pin,
  });
  assert.equal(opened.sccx_shift_id, "TEST01-close");
  const login = await svc.login(pin, "10.9.0.1");
  await svc.answerWeedInStore(login.token, true);
  const refillId = crypto.randomUUID();
  sheet.tabs.POS_Refills.push({
    row_id: refillId,
    store_code: "PNY01",
    sku: "1001",
    qty: "4",
    kind: "REFILL",
    kitchen_status: "ACTIVE",
    created_at: "2026-11-03T18:00:00.000Z",
  });
  (svc as unknown as { db: SheetDb }).db.forgetCache();
  const stocked = await svc.state(login.token);
  assert.equal(stocked.phase, "sell");
  assert.equal(stocked.products.find((product) => product.sku === "1001")?.qty ?? 0, 0);
  await svc.confirmIncoming(login.token, { key: "test01-receive", lines: [{ kitchen_row_id: refillId, qty_received: 4 }] });
  assert.equal((await svc.state(login.token)).products.find((product) => product.sku === "1001")?.qty, 4);
  await svc.cashout(login.token, { key: "test01-cash", payment_method: "CASH", lines: [{ sku: "1001", qty: 2 }] });
  await svc.cashout(login.token, { key: "test01-debit", payment_method: "DEBIT", lines: [{ sku: "1001", qty: 1 }] });
  const dropped = await svc.deposit(login.token, { key: "test01-drop", amount_cents: 500, note: "mid shift" });
  assert.equal(dropped.cash_sales_cents, 2000);
  assert.equal(dropped.debit_sales_cents, 1000);
  assert.equal(dropped.deposited_cents, 500);
  assert.equal(dropped.cash_on_hand_cents, 1500);

  const till = await svc.state(login.token);
  assert.equal(till.totals.sales_cents, 3000);
  assert.equal(till.totals.cash_sales_cents, 2000);
  assert.equal(till.totals.debit_sales_cents, 1000);
  assert.equal(till.totals.deposited_cents, 500);
  assert.equal(till.totals.cash_on_hand_cents, 1500);
  assert.equal(till.close_lines.find((line) => line.sku === "1001")?.expected_qty, 1);

  await svc.beginClose(login.token);
  await svc.saveClosingCount(login.token, { sku: "1001", counted_qty: 0 });
  await svc.saveFinalDeposit(login.token, { amount_cents: 1000 });
  const resumed = new PosService(new SheetDb(sheet), { sheet, secrets, demo: null });
  const draft = await resumed.state(login.token);
  assert.equal(draft.phase, "end");
  assert.equal(draft.shift.status, "CLOSING");
  assert.equal(draft.close_lines.find((line) => line.sku === "1001")?.counted_qty, 0);
  assert.equal(draft.final_deposit_cents, 1000);
  assert.equal(draft.totals.cash_on_hand_cents, 1500);
  await resumed.submitClosingCount(login.token);

  const ended = await resumed.endShiftFromPos(login.token, {
    key: "test01-end",
    lines: [{ sku: "1001", counted_qty: 0, variance_reason: "short one" }],
    final_deposit_cents: 1000,
  });
  assert.equal(ended.message, END_SHIFT_MESSAGE);
  assert.equal(ended.closing.cash_sales_cents, 2000);
  assert.equal(ended.closing.debit_sales_cents, 1000);
  assert.equal(ended.closing.deposited_cents, 1500);
  assert.equal(ended.closing.cash_on_hand_cents, 500);
  assert.equal(ended.closing.shortage_cents, 1000);
  assert.equal(ended.closing.balance_cents, 1500);
  assert.equal(ended.closing.final_deposit_cents, 1000);

  const closed = new SheetDb(sheet);
  const after = new PosService(closed, { sheet, secrets, demo: null });
  await rejects(() => after.login(pin, "10.9.0.2"), "NO_SHIFT");
  const parts = (sheet.tabs.POS_Staff ?? [])
    .filter((row) => row.record_type === "STATE" && row.doc)
    .sort((a, b) => a.row_id.localeCompare(b.row_id));
  const saved = JSON.parse(parts.map((row) => row.doc).join("")) as {
    shifts: { sccx_shift_id: string; status: string; end_reason: string | null }[];
    deposits: { amount_cents: number; note: string | null }[];
    closings: { shortage_cents: number; cash_on_hand_cents: number; deposited_cents: number; debit_sales_cents: number }[];
    counts: { kind: string }[];
  };
  assert.equal(saved.shifts.find((row) => row.sccx_shift_id === "TEST01-close")?.status, "ENDED");
  assert.equal(saved.shifts.find((row) => row.sccx_shift_id === "TEST01-close")?.end_reason, "POS_END");
  assert.deepEqual(saved.deposits.map((row) => row.amount_cents).sort((a, b) => a - b), [500, 1000]);
  assert.equal(saved.closings[0]?.shortage_cents, 1000);
  assert.equal(saved.closings[0]?.cash_on_hand_cents, 500);
  assert.equal(saved.closings[0]?.debit_sales_cents, 1000);
  assert.equal(saved.counts.some((row) => row.kind === "CLOSING"), true);
  assert.equal((sheet.tabs.POS_Deposits ?? []).map((row) => row.amount_cents).sort().join(","), "1000,500");
  assert.equal((sheet.tabs.POS_Counts ?? []).some((row) => row.kind === "CLOSING" && row.counted_qty === "0"), true);
  assert.equal((sheet.tabs.POS_Shifts ?? []).find((row) => row.shift_id === "TEST01-close")?.status, "ENDED");
  assert.equal(JSON.stringify(sheet.tabs).includes(`"${pin}"`), false);

  sheet.tabs = {};
  assert.deepEqual(sheet.tabs, {});
});

test("paper refill cancels old unsized rows and loads sized bags, including unpriced sizes", () => {
  const catalog = new Set(catalogFromFeed(readCommittedPnyCatalog()).map((row) => row.sku));
  const existing = [{ row_id: "11111111-1111-4111-8111-111111111111", store_code: "PNY01", sku: "105", qty: "8", kitchen_status: "ACTIVE", batch_id: "old" }];
  const plan = planPaperRefills(existing, catalog);
  assert.equal(plan.cancel[0]?.kitchen_status, "CANCELLED");
  assert.equal(plan.cancel[0]?.sku, "105");
  assert.equal(plan.add.length, paperLines().length);
  assert.ok(plan.add.every((row) => row.batch_id === PAPER_BATCH && row.kind === "REFILL" && row.kitchen_status === "ACTIVE" && row.store_code === "PNY01"));
  assert.equal(plan.add.find((row) => row.sku === "105-28g")?.qty, "2");
  assert.equal(plan.add.find((row) => row.sku === "170-3g")?.qty, "10");
  assert.equal(plan.add.find((row) => row.sku === "170-28g")?.qty, "2");
  assert.equal(plan.add.find((row) => row.sku === "188")?.qty, "50");
  assert.ok(plan.flagged.includes("170-3g"));
  assert.ok(plan.flagged.includes("170-28g"));
  const again = planPaperRefills([...existing, ...plan.add], catalog);
  assert.equal(again.add.length, 0);
  assert.equal(again.cancel.some((row) => row.sku === "188"), false);
  const part1 = plan.add.filter((row) => !paperPart2Lines().some((line) => line.sku === row.sku));
  const part2 = planPaperRefills([...existing, ...part1], catalog);
  assert.equal(part2.add.find((row) => row.sku === "1000")?.qty, "30");
  assert.equal(part2.add.find((row) => row.sku === "1000")?.kind, "REFILL");
  assert.equal(part2.add.some((row) => row.sku === "600" || row.sku === "606" || row.sku === "593" || row.sku === "601"), false);
  assert.equal(part2.add.find((row) => row.sku === "607")?.qty, "1");
  assert.equal(quoteForSku("1000")?.cents, 250);
  assert.equal(quoteForSku("1006")?.cents, 250);
  assert.equal(quoteForSku("1026")?.cents, 1000);
  assert.equal(quoteForSku("1027")?.name, "MARLBORO");
  assert.equal(quoteForSku("1027")?.cents, 1000);
});

test("Flowers_Raw names a bare flower and charges the sale price without rewriting the stored product", async () => {
  assert.equal(saleCents("40|30"), 3000);
  assert.equal(saleCents(""), null);
  assert.equal(normalizeThc("36%%"), "36%");
  const grid = [
    ["Menu"],
    ["SKU", "Strain", "Tier", "Type", "THC", "Price_3G", "Price_5G", "Price_14G", "Price_28G", "ImageURL"],
    ["392", "RAINBOW KUSH", "AAA+", "IH", "30%", "20", "30", "", "", ""],
    ["392", "RAINBOW KUSH AAA+ SALE!", "BUDGET", "IH SALE", "30%", "20|10", "30|20", "", "", "https://example.com/392.jpg"],
    ["500", "PINK GODFATHER", "EXOTIC", "IH", "36%", "40", "60", "", "", "https://example.com/500.jpg"],
    ["9500", "JACK HERER LTD BAG", "EXOTIC", "IH SALE", "36%", "40|30", "", "", "", "https://example.com/9500.jpg"],
    ["502", "ALIEN SMACK PINK", "EXOTIC", "IH", "36", "40", "60", "", "", "https://example.com/502.jpg"],
  ];
  const index = flowersFromGrid(grid);
  assert.equal(index.get("392")?.tier, "BUDGET");
  assert.equal(index.get("392")?.strain, "RAINBOW KUSH");
  assert.equal(index.get("392")?.type, "IH");
  assert.equal(index.get("9500")?.strain, "JACK HERER LTD BAG");
  assert.equal(index.get("500")?.strain, "PINK GODFATHER");
  assert.notEqual(index.get("9500")?.sku, index.get("500")?.sku);
  assert.equal(flowerPriceCents(index, "392-3g"), 1000);
  assert.equal(flowerPriceCents(index, "9500-3g"), 3000);
  const kept = overlayFlower({ sku: "225-5g", name: "225-5g", category: "AA", price_cents: 2000, image_url: null }, index);
  assert.equal(kept.name, "225-5g");
  assert.equal(kept.price_cents, 2000);

  const h = harness();
  h.sheet.grids.Flowers_Raw = grid;
  await h.svc.syncSetb([
    { sku: "502-3g", name: "502-3g", category: "EXOTIC", price_cents: 4000, active: true },
    { sku: "1000", name: "BB LIGHTS", category: "Cigarettes", price_cents: 250, active: true },
  ]);
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "flower-start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-flower" });
  const login = await h.svc.login(String(started.pin), "10.0.0.77");
  await h.svc.answerWeedInStore(login.token, true);
  for (const sku of ["502-3g", "1000"]) {
    h.db.state.incoming.push({
      kitchen_row_id: crypto.randomUUID(),
      batch_id: "paper",
      store_code: "PNY01",
      sku,
      qty_sent: 2,
      kind: "REFILL",
      kitchen_created_at: "2026-11-03T18:00:00.000Z",
      imported_at: "2026-11-03T18:00:00.000Z",
      status: "PENDING_CONFIRM",
      qty_received: null,
      variance_reason: null,
      confirmed_shift_id: null,
      confirmed_at: null,
      linked_ledger_id: null,
      created_at: "2026-11-03T18:00:00.000Z",
    });
  }
  await h.svc.state(login.token);
  const pending = h.db.state.incoming.filter((row) => row.status === "PENDING_CONFIRM");
  await h.svc.confirmIncoming(login.token, { key: "receive-flower", lines: pending.map((row) => ({ kitchen_row_id: row.kitchen_row_id, qty_received: row.qty_sent })) });
  const view = await h.svc.state(login.token);
  const shown = view.products.find((product) => product.sku === "502-3g");
  assert.equal(shown?.name, "ALIEN SMACK PINK 3g");
  assert.equal(shown?.price_cents, 4000);
  assert.equal(shown?.image_url, "https://example.com/502.jpg");
  assert.equal(shown?.flower_type, "IH");
  assert.equal(shown?.thc, "36%");
  assert.equal(h.db.state.products.find((product) => product.sku === "502-3g")?.name, "502-3g");
  assert.equal(view.products.find((product) => product.sku === "1000")?.price_cents, 250);
  const menu = await h.svc.menu();
  assert.equal(menu.items?.find((item) => item.sku === "502-3g")?.name, "ALIEN SMACK PINK 3g");
  const sale = await h.svc.cashout(login.token, { key: "alien", lines: [{ sku: "502-3g", qty: 1 }] });
  assert.equal(sale.total_cents, 4000);
  assert.equal(h.db.state.products.find((product) => product.sku === "502-3g")?.name, "502-3g");
});

test("Items_Raw lists a stocked unpriced paper and keeps Marlboro at ten dollars", async () => {
  const index = itemsFromGrid([
    ["SKU", "Category", "Name", "Price_EACH"],
    ["709", "Add Ons", "RAW CONNOISSEUR KING SIZE SLIM + TIPS", "$5"],
    ["680, 681", "EDIBLES", "LIVE RESIN GUMMIES SOUR", "$16 / $35"],
    ["1014", "cigarettes", "CANADIAN CLASSICS ORIGINAL", "25/carton"],
    ["1027", "cigarettes", "MARLBORO", "$2.50"],
    ["610, 611", "EDIBLES", "BERRY", "$10 / $12 / $14"],
  ]);
  assert.equal(index.get("709")?.price_cents, 500);
  assert.equal(index.get("709")?.category, "ADD ONS");
  assert.equal(index.get("680")?.price_cents, 1600);
  assert.equal(index.get("680")?.name, "Sour 150mg Gummies IND");
  assert.equal(index.get("681")?.price_cents, 1600);
  assert.equal(index.get("682")?.name, "Sour 600mg Gummies IND");
  assert.equal(index.get("713")?.price_cents, 500);
  assert.equal(index.get("610")?.price_cents, 2000);
  assert.equal(index.get("844")?.price_cents, 3000);
  assert.equal(index.has("666"), false);
  const shared = expandSetbItems([["SKU", "Name", "Price_EACH"], ["9000, 9001, 9002, 9003", "HASH", "$40 / $30"]]);
  assert.equal(shared.items.find((item) => item.sku === "9000")?.flag, "ambiguous: $40 / $30");
  assert.equal(shared.items.find((item) => item.sku === "9000")?.unitCents, null);
  assert.equal(index.get("1014")?.price_cents, 250);
  assert.equal(itemsFromGrid([["SKU", "Name", "Price_EACH"], ["9998", "CONES", ""]]).has("9998"), false);
  assert.equal(itemsFromGrid([["SKU", "Name", "Price_EACH"], ["709.0", "RAW", "$5"]]).get("709")?.price_cents, 500);

  const merged = mergeItemsPriceGrid(
    [["SKU", "Unit_Price", "Note"], ["999", "1.00", "keep me"]],
    expandSetbItems([
      ["S", "Type", "Category", "Name", "THC", "MG", "Price_EACH", "ImageURL", "PPromo", "Status"],
      ["709", "", "Add Ons", "RAW CONNOISSEUR", "", "", "$5", "", "", "ACTIVE"],
      ["240, 241", "", "cigarettes", "GRABBA", "", "", "$5", "", "", "ACTIVE"],
      ["240, 241", "", "cigarettes", "GRABBA RedRose / RedHerring", "", "", "$5", "", "", "ACTIVE"],
    ]).items,
  );
  assert.equal(merged.filter((row) => row[0] === "240").length, 1);
  assert.equal(merged.find((row) => row[0] === "999")?.[2], "keep me");
  assert.equal(merged[0].includes("source_row"), true);

  const h = harness();
  h.sheet.tabs.Items_raw_price = [
    { SKU: "709", Unit_Price: "5.00", Name: "RAW CONNOISSEUR KING SIZE SLIM + TIPS", Category: "ADD ONS", Price_Flag: "" },
    { SKU: "1027", Unit_Price: "10.00", Name: "MARLBORO", Category: "CIGARETTES", Price_Flag: "" },
    { SKU: "1014", Unit_Price: "2.50", Name: "CANADIAN CLASSICS ORIGINAL", Category: "CIGARETTES", Carton_Price: "25", Price_Flag: "" },
    { SKU: "680", Unit_Price: "", Name: "SOUR", Category: "EDIBLES", Price_Flag: "ambiguous: $16 / $35" },
  ];
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "items-start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-items" });
  const login = await h.svc.login(String(started.pin), "10.0.0.88");
  await h.svc.answerWeedInStore(login.token, true);
  const at = "2026-11-04T02:00:00.000Z";
  h.db.state.balances.push(
    { sku: "709", qty: 5, updated_at: at, created_at: at },
    { sku: "1027", qty: 2, updated_at: at, created_at: at },
    { sku: "1014", qty: 0, updated_at: at, created_at: at },
  );
  const before = h.db.state.balances.map((row) => ({ ...row }));
  const menu = await h.svc.menu();
  assert.equal(menu.items?.find((item) => item.sku === "709")?.name, "RAW CONNOISSEUR KING SIZE SLIM + TIPS");
  assert.equal(menu.items?.find((item) => item.sku === "709")?.price_cents, 500);
  assert.equal(menu.items?.find((item) => item.sku === "709")?.category, "ADD ONS");
  assert.equal(menu.items?.some((item) => item.sku === "1014"), false);
  assert.equal(menu.items?.find((item) => item.sku === "1027")?.price_cents, 1000);
  assert.deepEqual(h.db.state.balances, before);
  const view = await h.svc.state(login.token);
  assert.equal(view.products.find((product) => product.sku === "709")?.price_cents, 500);
  const sale = await h.svc.cashout(login.token, { key: "paper", lines: [{ sku: "709", qty: 1 }] });
  assert.equal(sale.total_cents, 500);
  assert.equal(h.db.state.balances.find((row) => row.sku === "709")?.qty, 4);
});

test("missing cone and lighter rows are appended, and a priced sheet row is kept", async () => {
  assert.equal(quoteForSku("713")?.cents, 500);
  assert.equal(quoteForSku("713")?.name, "RAW Paper Cones 6PK");
  assert.equal(quoteForSku("717")?.cents, 500);
  assert.equal(quoteForSku("720")?.cents, 300);
  assert.equal(rawPriceRows().find((row) => row.SKU === "713")?.Unit_Price, "5.00");
  assert.equal(rawPriceRows().find((row) => row.SKU === "717")?.Name, "RAW Paper Cones 3PK King Size");
  assert.equal(rawPriceRows().find((row) => row.SKU === "720")?.Unit_Price, "3.00");

  const existing = [
    ["SKU", "Unit_Price", "Note", "Name", "Category", "Price_Flag"],
    ["999", "1.00", "keep me", "Extra", "ADD ONS", ""],
    ["711", "3.00", "ok", "RAW PAPER ORGANIC HEMP 1 1/4", "ADD ONS", ""],
    ["720", "", "bad", "", "", "unparsed: 3"],
  ];
  const plan = planItemsPriceRepair(existing, expandSetbItems([
    ["S", "Type", "Category", "Name", "THC", "MG", "Price_EACH"],
    ["711", "", "Add Ons", "RAW PAPER ORGANIC HEMP 1 1/4", "", "", "$3"],
    ["713", "", "Add Ons", "RAW PAPER CONES", "", "", "5"],
    ["717", "", "Add Ons", "RAW PAPER CONES", "", "", "5"],
    ["720", "", "Add Ons", "LIGHTER BIG", "", "", "3"],
  ]).items);
  const skuAt = plan.header.findIndex((header) => header.toLowerCase() === "sku");
  const noteAt = plan.header.findIndex((header) => header.toLowerCase() === "note");
  const priceAt = plan.header.findIndex((header) => header.toLowerCase() === "unit_price");
  const nameAt = plan.header.findIndex((header) => header.toLowerCase() === "name");
  const appended = new Set(plan.append.map((row) => row[skuAt]));
  const repaired = new Set(plan.updates.map((update) => update.values[skuAt]));
  assert.equal(appended.has("713"), true);
  assert.equal(appended.has("717"), true);
  assert.equal(appended.has("720"), false);
  assert.equal(appended.has("999"), false);
  assert.equal(appended.has("711"), false);
  assert.equal(repaired.has("720"), true);
  assert.equal(repaired.has("999"), false);
  assert.equal(repaired.has("711"), false);
  const lighter = plan.updates.find((update) => update.values[skuAt] === "720");
  assert.equal(lighter?.row, 4);
  assert.equal(lighter?.values[priceAt], "3.00");
  assert.equal(lighter?.values[nameAt], "Lighter Big");
  assert.equal(lighter?.values[noteAt], "bad");
  const cones = plan.append.find((row) => row[skuAt] === "713");
  assert.equal(cones?.[priceAt], "5.00");
  assert.equal(cones?.[nameAt], "RAW Paper Cones 6PK");

  const fromSheet = itemsFromPriceSheetRows([
    { SKU: "711", Unit_Price: "3.00", Name: "RAW PAPER ORGANIC HEMP 1 1/4", Category: "ADD ONS", Price_Flag: "" },
  ]);
  assert.equal(fromSheet.get("713")?.price_cents, 500);
  assert.equal(fromSheet.get("717")?.name, "RAW Paper Cones 3PK King Size");
  assert.equal(fromSheet.get("720")?.price_cents, 300);
  assert.equal(fromSheet.get("711")?.price_cents, 300);

  const h = harness();
  const at = "2026-11-04T02:00:00.000Z";
  h.sheet.tabs.Items_raw_price = [
    { SKU: "711", Unit_Price: "3.00", Name: "RAW PAPER ORGANIC HEMP 1 1/4", Category: "ADD ONS", Price_Flag: "" },
  ];
  h.db.state.balances.push(
    { sku: "713", qty: 2, updated_at: at, created_at: at },
    { sku: "717", qty: 2, updated_at: at, created_at: at },
    { sku: "720", qty: 10, updated_at: at, created_at: at },
    { sku: "714", qty: 0, updated_at: at, created_at: at },
  );
  const before = h.sheet.tabs.Items_raw_price.map((row) => ({ ...row }));
  const menu = await h.svc.menu();
  assert.equal(menu.items?.find((item) => item.sku === "713")?.name, "RAW Paper Cones 6PK");
  assert.equal(menu.items?.find((item) => item.sku === "713")?.price_cents, 500);
  assert.equal(menu.items?.find((item) => item.sku === "713")?.category, "ADD ONS");
  assert.equal(menu.items?.find((item) => item.sku === "717")?.price_cents, 500);
  assert.equal(menu.items?.find((item) => item.sku === "720")?.name, "Lighter Big");
  assert.equal(menu.items?.find((item) => item.sku === "720")?.price_cents, 300);
  assert.equal(menu.items?.some((item) => item.sku === "714"), false);
  assert.deepEqual(h.sheet.tabs.Items_raw_price, before);
});

test("combined SETB rows split per SKU and a MANUAL price stays put", () => {
  assert.deepEqual(expandSkuCell("887/888/889"), ["887", "888", "889"]);
  assert.deepEqual(expandSkuCell("930-932"), ["930", "931", "932"]);
  assert.deepEqual(expandSkuCell("701, 702"), ["701", "702"]);
  const split = expandSetbItems([
    ["S", "Type", "Category", "Name", "THC", "MG", "Price_EACH"],
    ["887/888/889", "", "Vape Disposable", "GOOBER", "", "", "$35"],
    ["930-932", "", "PREROLLS", "KNOCK OUT HYBRID/INDICA/SATIVA", "", "", "$25"],
    ["701, 702", "", "cigarettes", "BACKWOODS", "", "", "$20"],
  ]);
  for (const sku of ["887", "888", "889"]) assert.equal(split.items.find((item) => item.sku === sku)?.unitCents, 3500);
  for (const sku of ["930", "931", "932"]) {
    const item = split.items.find((row) => row.sku === sku);
    assert.equal(item?.unitCents, 2500);
    assert.equal(item?.name, "KNOCK OUT HYBRID/INDICA/SATIVA");
  }
  assert.equal(split.items.find((item) => item.sku === "701")?.unitCents, 2000);
  assert.equal(split.items.find((item) => item.sku === "702")?.unitCents, 2000);

  const existing = [
    ["SKU", "Unit_Price", "Name", "Source", "Price_Flag", "Note"],
    ["930", "25.00", "KNOCK OUT", "SETB ITEMS_RAW", "", "keep"],
    ["720", "", "Lighter", "MANUAL", "", "locked"],
    ["714", "9.00", "My cigar", "", "MANUAL", "locked"],
    ["999", "1.00", "Extra", "", "", "keep me"],
  ];
  const plan = planItemsPriceRepair(existing, split.items);
  const skuAt = plan.header.findIndex((header) => header.toLowerCase() === "sku");
  const noteAt = plan.header.findIndex((header) => header.toLowerCase() === "note");
  const appended = new Set(plan.append.map((row) => row[skuAt]));
  const repaired = new Set(plan.updates.map((update) => update.values[skuAt]));
  assert.equal(appended.has("887") && appended.has("888") && appended.has("889"), true);
  assert.equal(appended.has("931") && appended.has("932"), true);
  assert.equal(appended.has("930"), false);
  assert.equal(appended.has("720"), false);
  assert.equal(appended.has("714"), false);
  assert.equal(appended.has("999"), false);
  assert.equal(repaired.has("930"), false);
  assert.equal(repaired.has("720"), false);
  assert.equal(repaired.has("714"), false);
  assert.equal(repaired.has("999"), false);
  assert.equal(plan.updates.some((update) => update.values[noteAt] === "locked" || update.values[noteAt] === "keep"), false);

  const priced = itemsFromPriceSheetRows([
    { SKU: "713", Unit_Price: "1.00", Name: "Staff cones", Category: "ADD ONS", Price_Flag: "MANUAL" },
    { SKU: "720", Unit_Price: "4.00", Name: "Staff lighter", Category: "ADD ONS", Source: "manual" },
  ]);
  assert.equal(priced.get("713")?.price_cents, 100);
  assert.equal(priced.get("713")?.name, "Staff cones");
  assert.equal(priced.get("720")?.price_cents, 400);
  assert.equal(priced.get("720")?.name, "Staff lighter");
});

test("verify count order, size label, and the staff discrepancy row", () => {
  assert.equal(sizeLabel("200-5g", "AA"), "5g");
  assert.equal(sizeLabel("350-5g", "AAA+"), "6g");
  assert.equal(sizeLabel("500-5g", "EXOTIC"), "6g");
  assert.equal(sizeLabel("1027", "CIGARETTES", "MARLBORO LIGHTS - GOLD"), "pack");
  assert.equal(staffSkuText("200-5g", "5g"), "#200 5g");
  assert.equal(staffSkuText("350-5g", "6g"), "#350 6g");
  assert.equal(staffSkuText("1027", "pack"), "#1027 pack");
  assert.equal(signedOff(-2), "-2");
  assert.equal(signedOff(1), "+1");
  assert.equal(signedOff(0), "0");
  assert.doesNotMatch(`${staffSkuText("200-5g", "5g")} ${signedOff(-2)}`, /[()]/);
  assert.doesNotMatch(staffSkuText("1027", "pack"), /-/);
  const ordered = [
    { sku: "9", name: "other", category: "MAGIC", bag: "each" },
    { sku: "801", name: "wax", category: "CONCENTRATES", bag: "each" },
    { sku: "1081", name: "vape", category: "VAPE PENS", bag: "each" },
    { sku: "610", name: "edible", category: "EDIBLES", bag: "each" },
    { sku: "713", name: "paper", category: "ADD ONS", bag: "each" },
    { sku: "1027", name: "marl", category: "CIGARETTES", bag: "pack" },
    { sku: "510-28g", name: "exotic", category: "EXOTIC", bag: "28g" },
    { sku: "410-28g", name: "premium", category: "PREMIUM", bag: "28g" },
    { sku: "210-14g", name: "budget later", category: "BUDGET", bag: "14g" },
    { sku: "200-14g", name: "budget", category: "BUDGET", bag: "14g" },
    { sku: "502-5g", name: "exotic 6", category: "EXOTIC", bag: "6g" },
    { sku: "400-5g", name: "premium 6", category: "PREMIUM", bag: "6g" },
    { sku: "360-5g", name: "aaa later", category: "AAA+", bag: "6g" },
    { sku: "350-5g", name: "aaa", category: "AAA+", bag: "6g" },
    { sku: "182-5g", name: "budget 5", category: "BUDGET", bag: "5g" },
    { sku: "502-3g", name: "exotic later", category: "EXOTIC", bag: "3g" },
    { sku: "500-3g", name: "exotic", category: "EXOTIC", bag: "3g" },
    { sku: "400-3g", name: "premium", category: "PREMIUM", bag: "3g" },
    { sku: "307-3g", name: "aaa", category: "AAA+", bag: "3g" },
    { sku: "277-3g", name: "aa", category: "AA", bag: "3g" },
    { sku: "190-3g", name: "budget later", category: "BUDGET", bag: "3g" },
    { sku: "182-3g", name: "budget first", category: "BUDGET", bag: "3g" },
  ].sort(compareCount).map((row) => row.sku);
  assert.deepEqual(ordered, [
    "182-3g", "190-3g", "277-3g", "307-3g", "400-3g", "500-3g", "502-3g",
    "182-5g", "350-5g", "360-5g", "400-5g", "502-5g",
    "200-14g", "210-14g",
    "410-28g", "510-28g",
    "1027", "713", "610", "1081", "801", "9",
  ]);
  const posSource = readFileSync("app/pos/PosApp.tsx", "utf8");
  const beforeDock = posSource.split('data-testid="pos-dock"')[0] ?? "";
  const dock = posSource.split('data-testid="pos-dock"')[1]?.split("</footer>")[0] ?? "";
  assert.doesNotMatch(beforeDock, /<VerifyBanner|<CountCard/);
  assert.match(dock, /<VerifyBanner slim/);
  assert.match(dock, /<CountCard\s+compact/);
  assert.match(posSource, /Done \/ Back to POS/);
  assert.match(posSource, /pny-gap-dismissed:/);
  assert.match(dock, /className=\{styles\.footerBar\}/);
  const clearAt = dock.indexOf('data-testid="clear-cart"');
  const cashAt = dock.indexOf(">Cashout<");
  const valueAt = dock.indexOf('data-testid="cart-total"');
  assert.ok(clearAt >= 0 && clearAt < cashAt && cashAt < valueAt);
  assert.doesNotMatch(dock, />Sell<|tickets-tab/);
  assert.match(posSource, /data-testid="tickets-back"/);
  const service = readFileSync("app/lib/pny-pos/service.ts", "utf8");
  assert.match(service, /sortCountSkus\(state, skus\)/);
  assert.match(service, /close_lines: \(\(\) => \{[\s\S]*?compareCount/);
  const row = readFileSync("app/pos/SkuOffList.tsx", "utf8");
  assert.match(row, /offId/);
  assert.match(row, /off > 0 \? `\+\$\{line\.off\}` : String\(line\.off\)/);
  assert.doesNotMatch(row, /expected|on-hand|on_hand|system_qty/i);
  const css = readFileSync("app/pos/till.module.css", "utf8");
  assert.match(css, /\.offList[\s\S]*flex-direction:\s*column/);
  assert.match(css, /\.offShort[\s\S]*#dc2626/);
  assert.match(css, /\.offOver[\s\S]*#16a34a/);
  assert.match(css, /\.offQty[\s\S]*font-size:\s*28px/);
  assert.match(css, /\.offId[\s\S]*font-weight:\s*800/);
  assert.match(css, /\.stockBlue[\s\S]*#dbeafe/);
  assert.match(css, /\.stockAmber[\s\S]*#fef3c7/);
  const drafts = [{
    shift_id: "s",
    counts: [],
    opening_counts: [{ sku: "200-5g", counted_qty: 3, expected_qty: 5, submitted_at: "2026-11-04T00:00:00.000Z" }],
    final_deposit_cents: null,
    updated_at: "2026-11-04T00:00:00.000Z",
  }];
  const token = signDemoDrafts(drafts, secrets.session);
  assert.deepEqual(readDemoDrafts(chunkToken(token).join(""), secrets.session), drafts);
});

test("sell 2 then verify-count the remainder is 0, and a later sale does not change it", async () => {
  const h = await readyTill({ "1001": 10, "1002": 5 });
  h.db.state.closings.push({
    shift_id: "previous",
    sales_total_cents: 0,
    sale_count: 0,
    void_count: 0,
    cash_on_hand_cents: 0,
    deposited_cents: 0,
    tickets_total: 0,
    tickets_cashed_out: 0,
    tickets_expired: 0,
    closing_lines: [{ sku: "1001", name: "Flower", left: 10, system_qty: 10 }],
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: false,
    summary_text: "",
    created_at: "2026-11-03T14:00:00.000Z",
  });
  await h.svc.syncSetb([
    { sku: "200-5g", name: "Budget", category: "BUDGET", price_cents: 1000, active: true },
    { sku: "350-5g", name: "AAA", category: "AAA+", price_cents: 2000, active: true },
    { sku: "1027", name: "MARLBORO LIGHTS - GOLD", category: "CIGARETTES", price_cents: 1000, active: true },
  ]);
  const before = qty(h.db, "1001");
  await h.svc.cashout(h.token, { key: "sell-two", lines: [{ sku: "1001", qty: 2 }] });
  assert.equal(qty(h.db, "1001"), before - 2);
  const saved = await h.svc.saveOpeningCount(h.token, { sku: "1001", counted_qty: 8 });
  assert.equal("off" in saved, false);
  assert.equal(qty(h.db, "1001"), 8);
  const row = h.db.state.closing_drafts.find((draft) => draft.shift_id === h.shiftId)?.opening_counts?.find((line) => line.sku === "1001");
  assert.equal(row?.expected_qty, 8);
  assert.equal(row?.counted_qty, 8);
  await h.svc.saveOpeningCount(h.token, { sku: "1002", counted_qty: 5 });
  await h.svc.cashout(h.token, { key: "sell-after", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(qty(h.db, "1001"), 7);
  const view = await h.svc.state(h.token);
  assert.equal(view.stock_check.opening.lines.some((line) => line.sku === "1001"), false);
  assert.equal(view.stock_check.opening.lines.every((line) => line.off !== 0), true);
  assert.equal(view.verify_admin, undefined);
  const blind = blindStaffState({ ...view, demo: true, verify_admin: { opening: [{ expected: 9, counted: 8 }] } });
  assert.equal(blind.verify_admin, undefined);
  assert.equal(JSON.stringify(blind.stock_check).includes("expected"), false);
  assert.doesNotMatch(readFileSync("app/pos/PosApp.tsx", "utf8"), /book |Expected /);
  assert.doesNotMatch(readFileSync("app/pos/CloseShift.tsx", "utf8"), /book |Expected |Confirm & End Shift/);
  assert.match(readFileSync("app/pos/TillSummary.tsx", "utf8"), /Open count/);
  assert.equal(blind.stock_check.opening.lines.some((line) => line.sku === "1001"), false);
  await h.svc.saveOpeningCount(h.token, { sku: "200-5g", counted_qty: 0 });
  await h.svc.saveOpeningCount(h.token, { sku: "350-5g", counted_qty: 1 });
  await h.svc.saveOpeningCount(h.token, { sku: "1027", counted_qty: 2 });
  const labels = (await h.svc.state(h.token)).verify.lines.filter((line) => ["200-5g", "350-5g", "1027"].includes(line.sku)).map((line) => line.text);
  assert.deepEqual(labels, ["#200 5g", "#350 6g", "#1027 pack"]);
});

test("moving between SKUs keeps blanks open, and Submit accepts them without changing stock", async () => {
  const h = await readyTill({ "1001": 10, "1002": 5, "1003": 2 });
  await h.svc.syncSetb([
    { sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true },
    { sku: "1002", name: "Gummy", category: "Edible", price_cents: 500, active: true },
    { sku: "1003", name: "Wax", category: "Concentrates", price_cents: 800, active: true },
  ]);
  const before = { "1001": qty(h.db, "1001"), "1002": qty(h.db, "1002"), "1003": qty(h.db, "1003") };
  await h.svc.jumpOpeningCount(h.token, "1002");
  const open = h.db.state.closing_drafts.find((row) => row.shift_id === h.shiftId);
  assert.equal(open?.opening_counts?.length ?? 0, 0);
  await h.svc.saveOpeningCount(h.token, { sku: "1002", counted_qty: 1 });
  const edited = h.db.state.closing_drafts.find((row) => row.shift_id === h.shiftId)?.opening_counts?.find((line) => line.sku === "1002");
  assert.ok(edited?.edited_at);
  assert.equal(edited?.expected_qty, 5);
  await h.svc.saveOpeningCount(h.token, { sku: "1002", counted_qty: 4 });
  const fixed = h.db.state.closing_drafts.find((row) => row.shift_id === h.shiftId)?.opening_counts?.find((line) => line.sku === "1002");
  assert.equal(fixed?.counted_qty, 4);
  const hidden = await h.svc.state(h.token);
  assert.equal(hidden.stock_check.opening.lines.length, 0);
  await h.svc.submitVerifyCount(h.token);
  const locked = await h.svc.state(h.token);
  const lines = locked.stock_check.opening.lines;
  assert.equal(lines.some((line) => line.sku === "1001"), false);
  assert.equal(lines.some((line) => line.sku === "1003"), false);
  assert.equal(lines.find((line) => line.sku === "1002")?.off, -1);
  assert.equal(qty(h.db, "1001"), before["1001"]);
  assert.equal(qty(h.db, "1002"), before["1002"]);
  assert.equal(qty(h.db, "1003"), before["1003"]);
});

test("reading state leaves an in-progress verify draft and the deadline alone", async () => {
  const h = await readyTill({ "1001": 10, "1002": 4 });
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  const opened = shift.verify_opened_at;
  const pin = shift.pin_hash;
  const sales = JSON.stringify(h.db.state.sales);
  const balances = JSON.stringify(h.db.state.balances);
  const drafts = h.db.state.closing_drafts;
  let draft = drafts.find((row) => row.shift_id === shift.id);
  if (!draft) {
    draft = { shift_id: shift.id, counts: [], opening_counts: [], final_deposit_cents: null, updated_at: "2026-11-04T18:10:00.000Z" };
    drafts.push(draft);
  }
  draft.opening_counts = [{ sku: "1001", counted_qty: 7, expected_qty: 10, submitted_at: "2026-11-04T18:10:00.000Z", accepted_as_is: false }];
  draft.verify_submitted_at = null;
  const view = await h.svc.state(h.token);
  assert.equal(view.verify?.reveal, false);
  assert.equal(view.verify?.lines?.find((line) => line.sku === "1001")?.counted_qty, 7);
  assert.equal(view.stock_check.opening.lines.length, 0);
  const kept = drafts.find((row) => row.shift_id === shift.id)?.opening_counts?.find((line) => line.sku === "1001");
  assert.equal(kept?.counted_qty, 7);
  assert.equal(kept?.expected_qty, 10);
  assert.equal(kept?.submitted_at, "2026-11-04T18:10:00.000Z");
  assert.equal(drafts.find((row) => row.shift_id === shift.id)?.verify_submitted_at ?? null, null);
  assert.equal(shift.verify_opened_at, opened);
  assert.equal(shift.pin_hash, pin);
  assert.equal(shift.status, "ACTIVE");
  assert.equal(JSON.stringify(h.db.state.sales), sales);
  assert.equal(JSON.stringify(h.db.state.balances), balances);
});

test("undoing a submitted verify restores pre-count stock and leaves the deadline", async () => {
  const h = await readyTill({ "1001": 10, "1002": 4 });
  h.db.state.closings.push({
    shift_id: "previous",
    sales_total_cents: 0,
    sale_count: 0,
    void_count: 0,
    cash_on_hand_cents: 0,
    deposited_cents: 0,
    tickets_total: 0,
    tickets_cashed_out: 0,
    tickets_expired: 0,
    closing_lines: [{ sku: "1001", name: "Flower", left: 10, system_qty: 10 }],
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: false,
    summary_text: "",
    created_at: "2026-11-03T14:00:00.000Z",
  });
  await h.svc.cashout(h.token, { key: "undo-sale", lines: [{ sku: "1001", qty: 2 }] });
  await h.svc.saveOpeningCount(h.token, { sku: "1001", counted_qty: 5 });
  await h.svc.submitVerifyCount(h.token);
  const balance = h.db.state.balances.find((row) => row.sku === "1001");
  assert.ok(balance);
  balance.qty = 3;
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  const opened = shift.verify_opened_at;
  const pin = shift.pin_hash;
  const sales = JSON.stringify(h.db.state.sales);
  const incoming = JSON.stringify(h.db.state.incoming);
  const deposits = JSON.stringify(h.db.state.deposits);
  const backup = await h.svc.exportVerifyBackup(h.shiftId);
  assert.equal(backup.verify_submitted_at != null, true);
  assert.equal(backup.opening_counts.some((row) => row.sku === "1001"), true);
  assert.equal(backup.stock.find((row) => row.sku === "1001")?.pre_count, 8);
  assert.equal(backup.stock.find((row) => row.sku === "1001")?.on_hand, 3);
  const undone = await h.svc.undoOpeningVerify(h.shiftId);
  assert.deepEqual(undone.stock_changes, [{ sku: "1001", from: 3, to: 8 }]);
  assert.equal(h.db.state.balances.find((row) => row.sku === "1001")?.qty, 8);
  assert.equal(h.db.state.balances.find((row) => row.sku === "1002")?.qty, 4);
  assert.equal(h.db.state.closing_drafts.find((row) => row.shift_id === shift.id)?.opening_counts?.length ?? 0, 0);
  assert.equal(h.db.state.closing_drafts.find((row) => row.shift_id === shift.id)?.verify_submitted_at ?? null, null);
  assert.equal(shift.verify_opened_at, opened);
  assert.equal(h.db.state.shifts.find((row) => row.id === shift.id)?.pin_hash, pin);
  assert.equal(JSON.stringify(h.db.state.sales), sales);
  assert.equal(JSON.stringify(h.db.state.incoming), incoming);
  assert.equal(JSON.stringify(h.db.state.deposits), deposits);
  const view = await h.svc.state(h.token);
  assert.equal(view.shift?.status, "ACTIVE");
  assert.equal(view.verify?.reveal, false);
  assert.equal(view.verify?.cleared, 0);
  assert.equal(view.verify?.total, view.verify?.lines?.length);
  assert.equal(view.stock_check.opening.lines.length, 0);
});

test("a shift with two sales is listed and not voided", async () => {
  const h = await readyTill({ "1001": 5, "1002": 5 });
  await h.svc.cashout(h.token, { key: "sale-a", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }] });
  await h.svc.cashout(h.token, { key: "sale-b", payment_method: "DEBIT", lines: [{ sku: "1002", qty: 1 }] });
  const listed = await h.svc.listShiftSales(h.shiftId);
  assert.equal(listed.sales.length, 2);
  assert.equal(listed.sales_total_cents > 0, true);
  await rejects(() => h.svc.voidOnlyShiftSale(h.shiftId, "nope"), "MANY_SALES");
  assert.equal(h.db.state.sales.filter((sale) => sale.status === "COMPLETED").length, 2);
});

test("voiding the only sale restores stock and the feed treats the next ring as new", async () => {
  const h = await readyTill({ "1001": 4 });
  const sold = await h.svc.cashout(h.token, { key: "only-sale", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(qty(h.db, "1001"), 3);
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  const pin = shift.pin_hash;
  const opened = shift.verify_opened_at;
  const deposits = JSON.stringify(h.db.state.deposits);
  const incoming = JSON.stringify(h.db.state.incoming);
  const counts = JSON.stringify(h.db.state.closing_drafts ?? []);
  const listed = await h.svc.listShiftSales(h.shiftId);
  assert.equal(listed.sales.length, 1);
  assert.equal(listed.sales[0]?.payment, "cash");
  const undone = await h.svc.voidOnlyShiftSale(h.shiftId, "Re-ring for SCCx");
  assert.equal(undone.sales_total_cents, 0);
  assert.equal(undone.cash_on_hand_cents, 0);
  assert.equal(qty(h.db, "1001"), 4);
  assert.equal(h.db.state.sales.find((sale) => sale.id === listed.sales[0]?.id)?.status, "VOIDED");
  const kept = h.db.state.shifts.find((row) => row.id === shift.id);
  assert.equal(kept?.pin_hash, pin);
  assert.equal(kept?.verify_opened_at, opened);
  assert.equal(kept?.status, "ACTIVE");
  assert.equal(JSON.stringify(h.db.state.deposits), deposits);
  assert.equal(JSON.stringify(h.db.state.incoming), incoming);
  assert.equal(JSON.stringify(h.db.state.closing_drafts ?? []), counts);
  const hidden = await h.svc.salesFeed(listed.sales[0]?.cursor ?? "0");
  assert.equal(hidden.sales.some((sale) => sale.id === listed.sales[0]?.id), false);
  await h.svc.cashout(h.token, { key: "rerung", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }] });
  const again = await h.svc.salesFeed(listed.sales[0]?.cursor ?? "0");
  assert.equal(again.sales.length, 1);
  assert.notEqual(again.sales[0]?.id, listed.sales[0]?.id);
  assert.equal(sold.total_cents > 0, true);
});

test("voiding the goose carton sale leaves the other sales and deposits", async () => {
  const h = await readyTill({ "1011": 20, "1012": 20, "1006": 8 });
  await h.svc.syncSetb([
    { sku: "1011", name: "CANADIAN GOOSE FULL", category: "CIGARETTES", price_cents: 250, active: true },
    { sku: "1012", name: "CANADIAN GOOSE LIGHTS", category: "CIGARETTES", price_cents: 250, active: true },
    { sku: "1006", name: "CANADIAN FULL", category: "CIGARETTES", price_cents: 250, active: true },
  ]);
  await h.svc.cashout(h.token, { key: "goose", payment_method: "CASH", lines: [{ sku: "1011", qty: 10 }, { sku: "1012", qty: 10 }] });
  const other = await h.svc.cashout(h.token, { key: "other", payment_method: "CASH", lines: [{ sku: "1006", qty: 4 }] });
  await h.svc.deposit(h.token, { key: "keep-deposit", amount_cents: 500 });
  const found = await h.svc.exportGooseCartonSale(h.shiftId);
  assert.equal(found.ok, true);
  if (!found.ok) return;
  assert.equal(found.sale.items.find((item) => item.sku === "1011")?.qty, 10);
  assert.equal(found.sale.items.find((item) => item.sku === "1012")?.qty, 10);
  const shift = h.db.state.shifts.find((row) => row.sccx_shift_id === h.shiftId || row.id === h.shiftId);
  assert.ok(shift);
  const pin = shift.pin_hash;
  const deposits = JSON.stringify(h.db.state.deposits);
  const counts = JSON.stringify(h.db.state.closing_drafts ?? []);
  const incoming = JSON.stringify(h.db.state.incoming);
  const undone = await h.svc.voidGooseCartonSale(h.shiftId, "Re-ring Goose cartons for SCCx");
  assert.equal(undone.sale.id, found.sale.id);
  assert.equal(qty(h.db, "1011"), 20);
  assert.equal(qty(h.db, "1012"), 20);
  assert.equal(qty(h.db, "1006"), 4);
  assert.equal(h.db.state.sales.find((sale) => sale.id === other.id || sale.ref_no === other.ref_no)?.status ?? h.db.state.sales.find((sale) => sale.id !== found.sale.id)?.status, "COMPLETED");
  assert.equal(h.db.state.sales.find((sale) => sale.id === found.sale.id)?.status, "VOIDED");
  assert.equal(undone.deposited_cents, 500);
  assert.equal(undone.cash_on_hand_cents, undone.sales_total_cents - 500);
  const kept = h.db.state.shifts.find((row) => row.id === shift.id);
  assert.equal(kept?.pin_hash, pin);
  assert.equal(kept?.status, "ACTIVE");
  assert.equal(JSON.stringify(h.db.state.deposits), deposits);
  assert.equal(JSON.stringify(h.db.state.closing_drafts ?? []), counts);
  assert.equal(JSON.stringify(h.db.state.incoming), incoming);
});

test("restarting the verify deadline changes only the clock", async () => {
  const h = await readyTill({ "1001": 4, "1002": 2 });
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  shift.verify_opened_at = "2026-11-04T17:38:18.755Z";
  shift.verify_release = "staff-verify-2026-11-04";
  const pin = shift.pin_hash;
  const status = shift.status;
  const balances = JSON.stringify(h.db.state.balances);
  const sales = JSON.stringify(h.db.state.sales);
  const counts = JSON.stringify(h.db.state.closing_drafts ?? []);
  const result = await h.svc.restartVerifyDeadline(shift.sccx_shift_id);
  const again = h.db.state.shifts.find((row) => row.id === shift.id);
  assert.equal(result.ok, true);
  assert.equal(again?.pin_hash, pin);
  assert.equal(again?.status, status);
  assert.equal(again?.verify_release, "staff-verify-2026-11-04");
  assert.notEqual(again?.verify_opened_at, "2026-11-04T17:38:18.755Z");
  assert.equal(Date.parse(result.deadline_at) - Date.parse(result.verify_opened_at), 2 * 60 * 60 * 1000);
  assert.equal(JSON.stringify(h.db.state.balances), balances);
  assert.equal(JSON.stringify(h.db.state.sales), sales);
  assert.equal(JSON.stringify(h.db.state.closing_drafts ?? []), counts);
});

test("found unlisted stock is added once only when the opening count is completed", async () => {
  const h = await readyTill({ "1001": 2, "1002": 0 });
  const savedQty = qty(h.db, "1002");
  await h.svc.saveOpeningCount(h.token, { sku: "1002", counted_qty: 3 });
  assert.equal(qty(h.db, "1002"), savedQty);
  const row = h.db.state.closing_drafts.find((draft) => draft.shift_id === h.shiftId)?.opening_counts?.find((line) => line.sku === "1002");
  assert.equal(row?.added_stock, true);
  assert.equal(row?.counted_qty, 3);
  assert.equal(row?.expected_qty, 0);
  await h.svc.submitVerifyCount(h.token);
  assert.equal(qty(h.db, "1002"), 3);
  const found = h.db.state.ledger.filter((entry) => entry.sku === "1002" && entry.movement_type === "COUNT_VARIANCE");
  assert.equal(found.length, 1);
  assert.equal(found[0]?.qty_delta, 3);
  assert.equal(found[0]?.reason, "FOUND_NOT_LISTED_AT_OPEN");
  assert.equal(h.db.state.count_lines.some((line) => line.sku === "1002" && line.system_qty === 0 && line.counted_qty === 3), true);
  await h.svc.submitVerifyCount(h.token);
  assert.equal(qty(h.db, "1002"), 3);
  assert.equal(h.db.state.ledger.filter((entry) => entry.sku === "1002" && entry.movement_type === "COUNT_VARIANCE").length, 1);
  const countCard = readFileSync("app/pos/CountCard.tsx", "utf8");
  assert.match(countCard, /Are there any SKUs with stock that are not listed\?/);
  assert.match(countCard, /Yes, add SKU/);
  assert.match(countCard, /No, complete open count/);
});

test("after two hours the verify card closes and uncounted SKUs are accepted with no discrepancy", async () => {
  const h = await readyTill({ "1001": 10, "1002": 4 });
  h.db.state.closings.push({
    shift_id: "previous",
    sales_total_cents: 0,
    sale_count: 0,
    void_count: 0,
    cash_on_hand_cents: 0,
    deposited_cents: 0,
    tickets_total: 0,
    tickets_cashed_out: 0,
    tickets_expired: 0,
    closing_lines: [
      { sku: "1001", name: "Flower", left: 10, system_qty: 10 },
      { sku: "1002", name: "Gummy", left: 4, system_qty: 4 },
    ],
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: false,
    summary_text: "",
    created_at: "2026-11-03T14:00:00.000Z",
  });
  h.db.state.incoming.push({
    kitchen_row_id: "refill-1001",
    batch_id: "b",
    store_code: "PNY01",
    sku: "1001",
    qty_sent: 3,
    kind: "REFILL",
    kitchen_created_at: null,
    imported_at: "2026-11-03T15:00:00.000Z",
    status: "CONFIRMED",
    qty_received: 3,
    variance_reason: null,
    confirmed_shift_id: h.shiftId,
    confirmed_at: "2026-11-03T15:00:00.000Z",
    linked_ledger_id: null,
    created_at: "2026-11-03T15:00:00.000Z",
  });
  await h.svc.cashout(h.token, { key: "window-sale", lines: [{ sku: "1001", qty: 2 }] });
  await h.svc.saveOpeningCount(h.token, { sku: "1002", counted_qty: 1 });
  const before = qty(h.db, "1001");
  h.clock.t = new Date(h.clock.t.getTime() + 2 * 60 * 60 * 1000 + 1000);
  const locked = await h.svc.state(h.token);
  const accepted = h.db.state.closing_drafts.find((draft) => draft.shift_id === h.shiftId)?.opening_counts?.find((line) => line.sku === "1001");
  assert.equal(locked.verify.show_banner, false);
  assert.equal(accepted?.accepted_as_is, true);
  assert.equal(accepted?.expected_qty, 11);
  assert.equal(accepted?.counted_qty, 11);
  assert.equal(locked.stock_check.opening.lines.some((line) => line.sku === "1001"), false);
  assert.equal(locked.verify.opening_lines.some((line) => line.sku === "1001"), false);
  assert.equal(locked.stock_check.opening.lines.find((line) => line.sku === "1002")?.off, -3);
  assert.equal(qty(h.db, "1001"), before);
  await rejects(() => h.svc.saveOpeningCount(h.token, { sku: "1001", counted_qty: 1 }), "VERIFY_CLOSED");
  const sale = await h.svc.cashout(h.token, { key: "after-window", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(sale.total_cents, 1000);
  const still = await h.svc.state(h.token);
  assert.equal(still.verify.show_banner, false);
  assert.equal(still.stock_check.opening.lines.some((line) => line.sku === "1001"), false);
});

test("verify expected uses only received refills, and a short receipt is a refill issue", async () => {
  const h = await readyTill({ "1001": 10, "1002": 4 });
  h.db.state.closings.push({
    shift_id: "previous",
    sales_total_cents: 0,
    sale_count: 0,
    void_count: 0,
    cash_on_hand_cents: 0,
    deposited_cents: 0,
    tickets_total: 0,
    tickets_cashed_out: 0,
    tickets_expired: 0,
    closing_lines: [{ sku: "1001", name: "Flower", left: 10, system_qty: 10 }],
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: false,
    summary_text: "",
    created_at: "2026-11-03T14:00:00.000Z",
  });
  const pending = crypto.randomUUID();
  h.db.state.incoming.push({
    kitchen_row_id: pending,
    batch_id: "wait",
    store_code: "PNY01",
    sku: "1001",
    qty_sent: 5,
    kind: "REFILL",
    kitchen_created_at: null,
    imported_at: "2026-11-03T15:00:00.000Z",
    status: "PENDING_CONFIRM",
    qty_received: null,
    variance_reason: null,
    confirmed_shift_id: null,
    confirmed_at: null,
    linked_ledger_id: null,
    created_at: "2026-11-03T15:00:00.000Z",
  });
  await h.svc.state(h.token);
  assert.equal(qty(h.db, "1001"), 10);
  await h.svc.saveOpeningCount(h.token, { sku: "1001", counted_qty: 10 });
  const frozen = h.db.state.closing_drafts.find((draft) => draft.shift_id === h.shiftId)?.opening_counts?.find((line) => line.sku === "1001");
  assert.equal(frozen?.expected_qty, 10);
  await h.svc.confirmIncoming(h.token, { key: "short-refill", lines: [{ kitchen_row_id: pending, qty_received: 2 }] });
  assert.equal(qty(h.db, "1001"), 12);
  assert.equal(h.db.state.incoming.find((row) => row.kitchen_row_id === pending)?.qty_sent, 5);
  const view = await h.svc.state(h.token);
  const issue = view.stock_check.refills.lines.find((line) => line.sku === "1001");
  assert.equal(view.stock_check.refills.count, 1);
  assert.equal(issue?.sent, 5);
  assert.equal(issue?.received, 2);
  assert.equal(issue?.diff, -3);
  const blind = blindStaffState(view);
  assert.equal(blind.stock_check.refills.lines[0]?.sent, 5);
  assert.equal(JSON.stringify(blind.stock_check).includes("expected"), false);
  assert.equal(blind.incoming?.length ?? 0, 0);
});

test("master login does not start the verify window and cannot change the shift", async () => {
  const h = harness();
  await h.svc.syncSetb([{ sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true }]);
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "ob-master", sku: "1001", qty: 2 });
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "start-master", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-master" });
  const shift = h.db.state.shifts.find((row) => row.sccx_shift_id === "sccx-master");
  const hash = shift?.pin_hash;
  const openedAt = shift?.started_at;
  h.clock.t = new Date(h.clock.t.getTime() + 30 * 60 * 1000);
  const master = await h.svc.login("1988", "10.8.0.1");
  const preview = await h.svc.state(master.token);
  const during = h.db.state.shifts.find((row) => row.sccx_shift_id === "sccx-master");
  assert.equal(preview.master, true);
  assert.equal(preview.shift?.status, "ACTIVE");
  assert.equal(preview.verify?.waiting, true);
  assert.equal(preview.verify?.deadline_at, null);
  assert.equal(preview.verify?.show_banner, false);
  assert.equal(during?.verify_opened_at ?? null, null);
  assert.equal(during?.pin_hash, hash);
  assert.equal(during?.started_at, openedAt);
  const before = qty(h.db, "1001");
  await rejects(() => h.svc.cashout(master.token, { key: "master-sale", lines: [{ sku: "1001", qty: 1 }] }), "MASTER_VIEW");
  await rejects(() => h.svc.saveOpeningCount(master.token, { sku: "1001", counted_qty: 1 }), "MASTER_VIEW");
  assert.equal(qty(h.db, "1001"), before);
  const staff = await h.svc.login(String(started.pin), "10.8.0.2");
  await h.svc.answerWeedInStore(staff.token, true);
  const live = await h.svc.state(staff.token);
  const after = h.db.state.shifts.find((row) => row.sccx_shift_id === "sccx-master");
  assert.equal(live.master, false);
  assert.equal(live.verify?.show_banner, true);
  assert.equal(after?.pin_hash, hash);
  const anchor = Date.parse(after?.verify_opened_at ?? "");
  assert.equal(anchor, h.clock.t.getTime());
  assert.equal(Date.parse(live.verify?.deadline_at ?? "") - anchor, 2 * 60 * 60 * 1000);
  h.clock.t = new Date(h.clock.t.getTime() + 10 * 60 * 1000);
  await h.svc.login(String(started.pin), "10.8.0.3");
  const again = h.db.state.shifts.find((row) => row.sccx_shift_id === "sccx-master");
  assert.equal(Date.parse(again?.verify_opened_at ?? ""), anchor);
});

test("master PIN can view the last ended shift without reopening it", async () => {
  const h = harness();
  await h.svc.syncSetb([{ sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true }]);
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "ob-ended-master", sku: "1001", qty: 2 });
  await h.svc.importRoster({ key: "roster-ended", staff: [{ staff_uid: "staff-ended", pos_id: "E1", display_name: "Ended Staff", active: true }] });
  const started = await h.svc.startShift({ key: "start-ended-master", store: "PNY01", staff_ref: "staff-ended", shift_id: "sccx-ended-master" });
  const staffLogin = await h.svc.login(String(started.pin), "10.8.1.1");
  const shift = h.db.state.shifts.find((row) => row.sccx_shift_id === "sccx-ended-master");
  assert.ok(shift);
  shift.status = "ENDED";
  shift.ended_at = h.clock.t.toISOString();
  shift.end_reason = "POS_END";
  const verifyOpenedAt = shift.verify_opened_at ?? null;
  const oldSession = h.db.state.sessions.find((row) => row.shift_id === shift.id);
  if (oldSession) oldSession.revoked_at = h.clock.t.toISOString();
  await rejects(() => h.svc.login(String(started.pin), "10.8.1.2"), "NO_SHIFT");

  const master = await h.svc.login("1988", "10.8.1.3");
  const preview = await h.svc.state(master.token);
  assert.equal(preview.master, true);
  assert.equal(preview.shift?.status, "ENDED");
  assert.equal(shift.status, "ENDED");
  assert.equal(shift.verify_opened_at ?? null, verifyOpenedAt);
  await rejects(() => h.svc.cashout(master.token, { key: "ended-master-sale", lines: [{ sku: "1001", qty: 1 }] }), "MASTER_VIEW");
  await rejects(() => h.svc.beginClose(master.token), "MASTER_VIEW");
  assert.equal(h.db.state.sales.length, 0);
  await rejects(() => h.svc.state(staffLogin.token), "NO_SESSION");

  const nextPin = String(started.pin) === "1357" ? "2468" : "1357";
  const reopened = await h.svc.openShiftWithPin({
    staff_uid: "staff-ended",
    display_name: "Ended Staff",
    pos_id: "E1",
    shift_id: "sccx-ended-master-next",
    pin: nextPin,
  });
  assert.equal(reopened.ok, true);
  await rejects(() => h.svc.login(String(started.pin), "10.8.1.4"), "BAD_PIN");
  const nextLogin = await h.svc.login(nextPin, "10.8.1.5");
  assert.equal(nextLogin.staff_name, "Ended Staff");
});

test("a deposit equal to cash on hand is allowed", async () => {
  const h = await readyTill();
  await h.svc.cashout(h.token, { key: "exact-sale", lines: [{ sku: "1001", qty: 1 }] });
  const exact = await h.svc.deposit(h.token, { key: "exact", amount_cents: 1000 });
  assert.equal(exact.cash_on_hand_cents, 0);
  assert.equal(exact.deposited_cents, 1000);
  const again = await readyTill();
  await again.svc.cashout(again.token, { key: "round-sale", lines: [{ sku: "1001", qty: 1 }] });
  const rounded = await again.svc.deposit(again.token, { key: "round", amount_cents: 1000.4 });
  assert.equal(rounded.cash_on_hand_cents, 0);
  const over = await readyTill();
  await over.svc.cashout(over.token, { key: "over-sale", lines: [{ sku: "1001", qty: 1 }] });
  const overDrop = await over.svc.deposit(over.token, { key: "over", amount_cents: 1000.6 });
  assert.equal(overDrop.deposited_cents, 1001);
  assert.equal(overDrop.cash_on_hand_cents, -1);
  const close = await readyTill();
  await close.svc.cashout(close.token, { key: "final-sale", lines: [{ sku: "1001", qty: 1 }] });
  const finalDeposit = await close.svc.saveFinalDeposit(close.token, { amount_cents: 1000 });
  assert.equal(finalDeposit.final_deposit_cents, 1000);
  assert.equal(finalDeposit.cash_on_hand_cents, 1000);
});

test("a deposit above recorded cash is kept and the shift can end over or short", async () => {
  assert.equal(signedMoney(250), "+$2.50");
  assert.equal(signedMoney(-250), "-$2.50");
  assert.equal(signedMoney(0), "$0.00");
  const service = readFileSync("app/lib/pny-pos/service.ts", "utf8");
  assert.doesNotMatch(service, /OVER_COH/);
  assert.match(service, /DEPOSIT_ABOVE/);
  const closeUi = readFileSync("app/pos/CloseShift.tsx", "utf8");
  assert.match(readFileSync("app/pos/TillSummary.tsx", "utf8"), /FINAL TILL BALANCE/);
  assert.match(closeUi, /Float left in the till/);
  assert.doesNotMatch(closeUi, /both stores/i);
  assert.doesNotMatch(closeUi, /Math\.max\(0,\s*totals\.cash_on_hand_cents/);
  assert.doesNotMatch(readFileSync("app/pos/till/TillApp.tsx", "utf8"), /larger deposit is blocked/);

  const over = await readyTill();
  await over.svc.cashout(over.token, { key: "over-sale", lines: [{ sku: "1001", qty: 1 }] });
  await rejects(() => over.svc.deposit(over.token, { key: "zero", amount_cents: 0 }), "BAD_AMOUNT");
  await rejects(() => over.svc.deposit(over.token, { key: "neg", amount_cents: -100 }), "BAD_AMOUNT");
  await rejects(() => over.svc.saveFinalDeposit(over.token, { amount_cents: -1 }), "BAD_AMOUNT");
  const dropped = await over.svc.deposit(over.token, { key: "over-drop", amount_cents: 1500 });
  assert.equal(dropped.deposited_cents, 1500);
  assert.equal(dropped.cash_on_hand_cents, -500);
  const saved = await over.svc.saveFinalDeposit(over.token, { amount_cents: 200 });
  assert.equal(saved.final_deposit_cents, 200);
  const view = await over.svc.state(over.token);
  await submitClosingValues(over.svc, over.token);
  const ended = await over.svc.endShiftFromPos(over.token, {
    key: "end-over",
    final_deposit_cents: 200,
    lines: (view.close_lines ?? []).map((line) => ({ sku: line.sku, counted_qty: line.expected_qty })),
  });
  assert.equal(ended.closing.deposited_cents, 1700);
  assert.equal(ended.closing.cash_on_hand_cents, -700);
  assert.equal(ended.closing.balance_cents, -700);

  const short = await readyTill();
  await short.svc.cashout(short.token, { key: "short-sale", lines: [{ sku: "1001", qty: 1 }] });
  const shortView = await short.svc.state(short.token);
  await submitClosingValues(short.svc, short.token);
  const shortEnd = await short.svc.endShiftFromPos(short.token, {
    key: "end-short",
    final_deposit_cents: 400,
    lines: (shortView.close_lines ?? []).map((line) => ({ sku: line.sku, counted_qty: line.expected_qty })),
  });
  assert.equal(shortEnd.closing.balance_cents, 600);
  assert.equal(shortEnd.closing.cash_on_hand_cents, 600);
});

test("each new deposit gets a unique slip number and a past deposit stays n/a", async () => {
  const h = await readyTill();
  await h.svc.cashout(h.token, { key: "slip-sale", lines: [{ sku: "1001", qty: 1 }] });
  const first = await h.svc.deposit(h.token, { key: "slip-a", amount_cents: 400 });
  const again = await h.svc.deposit(h.token, { key: "slip-a", amount_cents: 400 });
  const second = await h.svc.deposit(h.token, { key: "slip-b", amount_cents: 100 });
  assert.equal(first.deposit_code, "PNY-D0001");
  assert.equal(again.deposit_code, "PNY-D0001");
  assert.equal(second.deposit_code, "PNY-D0002");
  assert.equal(h.db.state.deposit_seq, 2);
  assert.equal(h.db.state.deposits.filter((row) => row.deposit_code === first.deposit_code).length, 1);
  h.db.state.deposits.push({
    id: "old-deposit",
    shift_id: h.shiftId,
    staff_uid: "staff-a",
    amount_cents: 50,
    note: null,
    created_at: "2026-11-03T14:00:00.000Z",
  });
  const summary = await h.svc.shiftSummary(h.token);
  assert.match(summary.text, new RegExp(`Deposit ${first.deposit_code} `));
  assert.match(summary.text, /Deposit n\/a /);
  assert.equal(depositCodeLabel(undefined), "n/a");
  assert.equal(depositCodeLabel("D0004"), "D0004");
  assert.equal(depositCodeLabel(first.deposit_code), first.deposit_code);
  assert.equal(nextDepositSeq(0, ["D0004", "PNY-D0002"]), 5);
  const finalDeposit = await h.svc.saveFinalDeposit(h.token, { amount_cents: 200 });
  const repeated = await h.svc.saveFinalDeposit(h.token, { amount_cents: 150 });
  assert.equal(finalDeposit.deposit_code, "PNY-D0003");
  assert.equal(repeated.deposit_code, "PNY-D0003");
  const view = await h.svc.state(h.token);
  await submitClosingValues(h.svc, h.token);
  const ended = await h.svc.endShiftFromPos(h.token, {
    key: "slip-end",
    final_deposit_cents: 150,
    lines: (view.close_lines ?? []).map((line) => ({ sku: line.sku, counted_qty: line.system_qty })),
  });
  assert.equal(ended.message, END_SHIFT_MESSAGE);
  const finals = h.db.state.deposits.filter((row) => row.note === "final deposit");
  assert.equal(finals.length, 1);
  assert.equal(finals[0]?.deposit_code, finalDeposit.deposit_code);
  const admin = await h.svc.adminState(h.admin);
  assert.equal(admin.deposits.find((row) => row.id === finals[0]?.id)?.deposit_code, finalDeposit.deposit_code);
  assert.equal(admin.deposits.find((row) => row.id === "old-deposit")?.deposit_code, null);
  assert.match(readFileSync("app/pos/DepositSlip.tsx", "utf8"), /Write the full Deposit #, including PNY, on a slip of paper and attach it to the money\./);
  assert.match(readFileSync("app/pos/DepositSlip.tsx", "utf8"), /Done, slip attached/);
  assert.match(readFileSync("app/pos/till/TillApp.tsx", "utf8"), /deposit_code/);
  assert.match(summary.text, /PNY-D0001/);
});

test("PNY02 keeps its own stock, orders, and deposits away from PNY01", async () => {
  const h = await readyTill({ "1001": 4, "1002": 0 });
  const before = qty(h.db, "1001");
  await h.svc.cashout(h.token, { key: "pny01-sale", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(h.db.state.sales.at(-1)?.ref_no, "PNY01-00001");
  assert.equal(qty(h.db, "1001"), before - 1);
  const opened = await runStore(PNY02_STORE, () => h.svc.openShiftWithPin({
    staff_uid: "staff-a",
    display_name: "Ada",
    pos_id: "A1",
    shift_id: "pny02-shift",
    pin: "4321",
  }));
  assert.equal(opened.ok, true);
  const login = await runStore(PNY02_STORE, () => h.svc.login("4321", "10.2.0.1"));
  const pny2OnHand = await runStore(PNY02_STORE, async () => (await h.svc.state(login.token)).products?.find((row) => row.sku === "1001")?.qty ?? 0);
  assert.equal(pny2OnHand, 0);
  await runStore(PNY02_STORE, () => h.svc.openingBalance(h.admin, { key: "pny2-open", sku: "1001", qty: 3 }));
  const sold = await runStore(PNY02_STORE, () => h.svc.cashout(login.token, { key: "pny2-sale", lines: [{ sku: "1001", qty: 1 }] }));
  assert.equal(sold.ref_no, "PNY02-00001");
  const drop = await runStore(PNY02_STORE, () => h.svc.deposit(login.token, { key: "pny2-drop", amount_cents: 2500 }));
  assert.equal(drop.deposit_code, "PNY2-D0001");
  assert.equal(drop.cash_on_hand_cents, -1500);
  assert.equal(qty(h.db, "1001"), before - 1);
  assert.equal(h.db.state.balances.find((row) => row.sku === "1001" && row.store_code === "PNY02")?.qty, 2);
  const pny1 = await h.svc.state(h.token);
  assert.equal(pny1.totals?.sales_cents, 1000);
  assert.equal(pny1.totals?.deposited_cents, 0);
  const feed = await h.svc.salesFeed(null);
  assert.equal(feed.store, "PNY01");
  const pny2Feed = await runStore(PNY02_STORE, () => h.svc.salesFeed("0"));
  assert.equal(pny2Feed.store, "PNY02");
  assert.equal(pny2Feed.sales?.length, 1);
  assert.equal(pny2Feed.sales?.[0]?.order_no, "PNY02-00001");
  assert.equal(pny2Feed.sales?.[0]?.shift_order_number, 1);
  assert.deepEqual(PNY2_STOCK_HEADERS, ["sku", "name", "category", "price_cents", "on_hand", "updated_at"]);
  assert.equal(PNY02_STORE.stockTab, "PNY2");
  assert.doesNotMatch(readFileSync("app/lib/pny-pos/sheetStore.ts", "utf8"), /upsert\("PNY01"/);
});

test("stock history appends one row per changed SKU and a sheet failure still sells", async () => {
  const h = await readyTill({ "1001": 4, "1002": 2 });
  h.sheet.configured = true;
  const sold = await h.svc.cashout(h.token, { key: "hist-sale", lines: [{ sku: "1001", qty: 1 }, { sku: "1002", qty: 2 }] });
  const rows = h.sheet.tabs.Stock_History ?? [];
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.event, "sale");
  assert.equal(rows[0]?.store, "PNY01");
  assert.equal(rows[0]?.source, "pos");
  assert.equal(rows[0]?.note, sold.ref_no);
  assert.equal(rows[0]?.sku, "1001");
  assert.equal(rows[0]?.delta, "-1");
  assert.equal(rows[0]?.on_hand_after, "3");
  assert.equal(rows[0]?.staff, "Anom");
  assert.equal(rows[0]?.shift_id, "sccx-a");
  assert.equal(rows[1]?.sku, "1002");
  assert.equal(rows[1]?.delta, "-2");
  assert.equal(rows[1]?.on_hand_after, "0");
  const again = await h.svc.cashout(h.token, { key: "hist-sale-2", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(h.sheet.tabs.Stock_History?.length, 3);
  assert.equal(h.sheet.tabs.Stock_History?.[0]?.note, sold.ref_no);
  assert.equal(h.sheet.tabs.Stock_History?.[2]?.note, again.ref_no);
  const saleId = h.db.state.sales[0]?.id ?? "";
  await h.svc.voidSale(h.admin, { key: "hist-void", sale_id: saleId, reason: "mis-ring" });
  const voided = (h.sheet.tabs.Stock_History ?? []).filter((row) => row.event === "void");
  assert.equal(voided.length, 2);
  assert.equal(voided.every((row) => row.note === sold.ref_no), true);
  assert.equal(h.sheet.tabs.Stock_History?.[0]?.note, sold.ref_no);

  const broken = await readyTill({ "1001": 2, "1002": 1 });
  broken.sheet.configured = true;
  broken.sheet.appendStockHistory = async () => {
    throw new Error("sheet down");
  };
  const still = await broken.svc.cashout(broken.token, { key: "hist-down", lines: [{ sku: "1001", qty: 1 }] });
  assert.equal(still.ref_no.startsWith("PNY01-"), true);
  assert.equal(qty(broken.db, "1001"), 1);
});

test("stock history uses the quarterly spreadsheet and monthly tab when configured", async () => {
  assert.deepEqual(historyPeriod("2026-11-03T15:00:00.000Z"), { quarter: "2026-Q4", tab: "History_2026-11" });
  assert.equal(historySheetConfig([{ key: "2026-Q4", spreadsheet_id: "from-tab" }, { key: "analytics", spreadsheet_id: "skip" }], "2026-Q4=from-env").get("2026-Q4"), "from-env");
  assert.equal(historySheetConfig([{ key: "2026-Q4", spreadsheet_id: "from-tab" }], undefined).get("analytics"), undefined);
  const saved = process.env.PNY_HISTORY_SHEETS;
  process.env.PNY_HISTORY_SHEETS = "2026-Q4=hist-q4";
  try {
    const h = await readyTill({ "1001": 3, "1002": 1 });
    h.sheet.configured = true;
    const sold = await h.svc.cashout(h.token, { key: "hist-q", lines: [{ sku: "1001", qty: 1 }] });
    const stored = h.sheet.books["hist-q4"]?.["History_2026-11"] ?? [];
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.note, sold.ref_no);
    assert.equal(stored[0]?.event, "sale");
    assert.equal(stored[0]?.source, "pos");
    assert.equal(h.sheet.tabs.Stock_History, undefined);
    delete process.env.PNY_HISTORY_SHEETS;
    h.sheet.tabs.History_Config = [{ key: "2026-Q4", spreadsheet_id: "from-config" }];
    await h.svc.cashout(h.token, { key: "hist-config", lines: [{ sku: "1001", qty: 1 }] });
    assert.equal(h.sheet.books["from-config"]?.["History_2026-11"]?.length, 1);
    assert.equal(h.sheet.books["hist-q4"]?.["History_2026-11"]?.length, 1);
  } finally {
    if (saved == null) delete process.env.PNY_HISTORY_SHEETS;
    else process.env.PNY_HISTORY_SHEETS = saved;
  }
});

test("final deposit stamps the stock close label and appends a snapshot", async () => {
  assert.equal(masterIdFor("PNY01", "2026-11-04"), "PNY-1104");
  assert.equal(closeLabelFor("PNY-1104", "2026-11-05T15:00:00.000Z"), "PNY-1104-1105");
  assert.equal(masterIdFor("PNY02", "2026-11-06"), "PNY2-1106");
  const h = await readyTill({ "1001": 4, "1002": 2 });
  h.sheet.configured = true;
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.equal(shift?.status, "ACTIVE");
  await submitClosingValues(h.svc, h.token, { "1001": 3, "1002": 2 });
  const ended = await h.svc.endShiftFromPos(h.token, { key: "label-end", final_deposit_cents: 0, lines: [] });
  assert.equal(ended.close_label, "PNY-1104-1103");
  assert.match(ended.summary_text ?? "", /Close: PNY-1104-1103/);
  assert.equal(h.db.state.shifts.find((row) => row.id === shift?.id)?.status, "ENDED");
  assert.equal(h.sheet.tabs.Stock_Labels?.length, 1);
  assert.equal(h.sheet.tabs.Stock_Labels?.[0]?.master_id, "PNY-1104");
  assert.equal(h.sheet.tabs.Stock_Labels?.[0]?.start_date, "2026-11-04");
  assert.equal(h.sheet.tabs.Stock_Labels?.[0]?.store, "PNY01");
  const flower = h.sheet.tabs.Close_Snapshots?.find((row) => row.sku === "1001");
  const plain = h.sheet.tabs.Close_Snapshots?.find((row) => row.sku === "1002");
  assert.equal(flower?.close_label, "PNY-1104-1103");
  assert.equal(flower?.name, "Flower");
  assert.equal(flower?.category, "Flower");
  assert.equal(flower?.qty, "3");
  assert.equal(flower?.discrepancy, "-1");
  assert.equal(plain?.qty, "2");
  assert.equal(plain?.discrepancy, "0");
  const feed = await h.svc.readClosings();
  assert.equal(feed.closings.find((row) => row.shift_id === "sccx-a")?.close_label, "PNY-1104-1103");
  assert.equal(feed.closings.find((row) => row.shift_id === "sccx-a")?.cash_sales, 0);
  const started = await h.svc.startShift({ key: "label-next", store: "PNY01", staff_ref: "staff-b", pos_id: "B1", shift_id: "sccx-b" });
  const next = await h.svc.login(String(started.pin), "10.4.0.2");
  await h.svc.answerWeedInStore(next.token, true);
  await submitClosingValues(h.svc, next.token);
  await h.svc.endShiftFromPos(next.token, { key: "label-end-2", final_deposit_cents: 0, lines: [] });
  assert.equal(h.sheet.tabs.Stock_Labels?.length, 1);

  const fresh = emptyState();
  const first = ensureStockLabel(fresh, "PNY02", "2026-11-06T15:00:00.000Z", "2026-11-06T15:00:00.000Z");
  const kept = ensureStockLabel(fresh, "PNY02", "2026-12-01T15:00:00.000Z", "2026-12-01T15:00:00.000Z");
  assert.equal(first.master_id, "PNY2-1106");
  assert.equal(kept.master_id, first.master_id);
  assert.match(readFileSync("app/pos/CloseShift.tsx", "utf8"), /data-testid="close-label"/);
});

test("closing summary stays until Done after session revoke", () => {
  const closeUi = readFileSync("app/pos/CloseShift.tsx", "utf8");
  const pos = readFileSync("app/pos/PosApp.tsx", "utf8");
  assert.match(closeUi, /data-testid="close-summary-banner"/);
  assert.match(closeUi, /Screenshot this and send it to the group before tapping Done/);
  assert.match(closeUi, /data-testid="close-summary-done"/);
  assert.match(closeUi, /resumeSummary/);
  assert.match(closeUi, /step === "summary"[\s\S]*visibility: "hidden"/);
  assert.match(pos, /closeHold/);
  assert.match(pos, /pos-close-hold/);
  assert.match(pos, /finishCloseSummary/);
  assert.match(pos, /!view\.authenticated && !\(sheet === "close" && closeHold && closeSnap\)/);
  assert.doesNotMatch(closeUi, /on-hand stock|expected stock/i);
});

test("PNY02 starting stock is added once and leaves PNY01 untouched", async () => {
  const h = harness();
  h.sheet.configured = true;
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "pny01-keep", sku: "1001", qty: 4 });
  const before = JSON.stringify(h.db.state.balances);
  await rejects(() => h.svc.loadPny2StartingStock(admin.token, { key: PNY2_START_KEY }), "STORE");
  assert.equal(JSON.stringify(h.db.state.balances), before);
  const loaded = await runStore(PNY02_STORE, () => h.svc.loadPny2StartingStock(admin.token, { key: PNY2_START_KEY }));
  assert.equal(loaded.unmapped.length, 0);
  assert.equal(loaded.loaded.length, pny2StartingLines().length);
  assert.equal(loaded.loaded.find((row) => row.sku === "172-3g")?.qty, 10);
  assert.equal(loaded.loaded.find((row) => row.sku === "172-28g")?.qty, 1);
  assert.equal(loaded.loaded.find((row) => row.sku === "187-28g")?.qty, 1);
  assert.equal(loaded.loaded.find((row) => row.sku === "315-5g")?.qty, 10);
  assert.equal(loaded.loaded.find((row) => row.sku === "188")?.qty, 60);
  assert.equal(loaded.loaded.find((row) => row.sku === "1010")?.qty, 15);
  assert.equal(h.db.state.balances.find((row) => row.sku === "1001" && !row.store_code)?.qty, 4);
  assert.equal(h.db.state.balances.some((row) => row.sku === "172-3g" && !row.store_code), false);
  assert.equal(h.db.state.balances.find((row) => row.sku === "172-3g" && row.store_code === "PNY02")?.qty, 10);
  const replay = await runStore(PNY02_STORE, () => h.svc.loadPny2StartingStock(admin.token, { key: PNY2_START_KEY }));
  assert.equal(replay.loaded.length, loaded.loaded.length);
  const second = await runStore(PNY02_STORE, () => h.svc.loadPny2StartingStock(admin.token, { key: "pny2-starting-stock-again" }));
  assert.equal(second.loaded.length, 0);
  assert.equal(second.skipped.length, pny2StartingLines().length);
  assert.equal(h.db.state.balances.find((row) => row.sku === "172-3g" && row.store_code === "PNY02")?.qty, 10);
  const history = h.sheet.tabs.Stock_History?.find((row) => row.sku === "172-3g");
  assert.equal(history?.store, "PNY02");
  assert.equal(history?.event, "added_stock");
  assert.equal(history?.delta, "10");
  assert.equal(history?.on_hand_after, "10");
  assert.equal(history?.note, PNY2_START_NOTE);
  const menu2 = await runStore(PNY02_STORE, () => h.svc.menu());
  assert.equal((menu2.items?.find((item) => item.sku === "172-3g")?.price_cents ?? 0) > 0, true);
  assert.equal(menu2.items?.find((item) => item.sku === "187-28g")?.name, "CHOCOLATE KUSH 28g");
  assert.equal(menu2.items?.find((item) => item.sku === "187-3g")?.name, "CHOCOLATE KUSH 3g");
  assert.equal(menu2.items?.find((item) => item.sku === "418-3g")?.name, "STRAWBERRY 3g");
  assert.equal(menu2.items?.some((item) => item.sku === "1001"), false);
  const menu1 = await h.svc.menu();
  assert.equal(menu1.items?.some((item) => item.sku === "172-3g" || item.sku === "188"), false);
});

test("closing count lets staff keep selling and a later sale keeps the difference", async () => {
  const h = await readyTill({ "1001": 4, "1002": 3 });
  const shift = h.db.state.shifts.find((row) => row.id === h.shiftId || row.sccx_shift_id === h.shiftId);
  assert.ok(shift);
  const pin = shift.pin_hash;
  const started = await h.svc.startClosingCount(h.token);
  assert.equal(started.status, "ACTIVE");
  assert.equal(shift.status, "ACTIVE");
  assert.equal(shift.pin_hash, pin);
  const open = await h.svc.state(h.token);
  assert.equal(open.can_sell, true);
  assert.equal(open.phase, "sell");
  assert.equal(open.closing?.started, true);
  assert.equal(open.closing?.submitted, false);
  assert.equal(JSON.stringify(open.closing).includes("expected"), false);
  assert.deepEqual(open.closing?.lines?.map((line) => line.sku), open.close_lines?.map((line) => line.sku));
  await h.svc.saveClosingCount(h.token, { sku: "1001", counted_qty: 4 });
  await h.svc.saveClosingCount(h.token, { sku: "1002", counted_qty: 2 });
  await h.svc.submitClosingCount(h.token);
  const draft = h.db.state.closing_drafts.find((row) => row.shift_id === shift.id);
  assert.equal(draft?.closing_submitted_at != null, true);
  assert.equal(draft?.counts.some((row) => row.accepted_as_is), false);
  assert.equal(shift.status, "ACTIVE");
  const still = await h.svc.state(h.token);
  assert.equal(still.can_sell, true);
  assert.equal(still.closing?.submitted, true);
  h.clock.t = new Date(h.clock.t.getTime() + 1000);
  await h.svc.cashout(h.token, { key: "after-close-count", payment_method: "CASH", lines: [{ sku: "1001", qty: 1 }, { sku: "1002", qty: 1 }] });
  assert.equal(qty(h.db, "1001"), 3);
  assert.equal(qty(h.db, "1002"), 2);
  const ended = await h.svc.endShiftFromPos(h.token, { key: "end-after-count", final_deposit_cents: 0, lines: [] });
  const exact = ended.closing.closing_lines.find((row) => row.sku === "1001");
  const short = ended.closing.closing_lines.find((row) => row.sku === "1002");
  assert.equal(exact?.left, 3);
  assert.equal(exact?.expected_qty, 3);
  assert.equal(exact?.variance_qty, 0);
  assert.equal(short?.left, 1);
  assert.equal(short?.expected_qty, 2);
  assert.equal(short?.variance_qty, -1);
  assert.equal(qty(h.db, "1001"), 3);
  assert.equal(qty(h.db, "1002"), 1);
  assert.equal(ended.closing.shortage_cents, 500);
  assert.equal(h.db.state.shifts.find((row) => row.id === shift.id)?.status, "ENDED");
  assert.match(readFileSync("app/pos/PosApp.tsx", "utf8"), /Start closing count\?/);
  assert.match(readFileSync("app/pos/PosApp.tsx", "utf8"), /Not yet/);
  assert.match(readFileSync("app/pos/PosApp.tsx", "utf8"), /data-testid="closing-count"/);
});

test("closing count requires every SKU and explicit confirmation records blanks as zero", async () => {
  const h = await readyTill({ "1001": 4, "1002": 3 });
  await h.svc.startClosingCount(h.token);
  await h.svc.saveClosingCount(h.token, { sku: "1001", counted_qty: 4 });
  await assert.rejects(
    () => h.svc.submitClosingCount(h.token),
    (error: unknown) => {
      assert.ok(error instanceof PosError);
      assert.equal(error.code, "COUNT_INCOMPLETE");
      assert.deepEqual(error.details.blank_skus, ["1002"]);
      return true;
    },
  );
  await rejects(
    () => h.svc.endShiftFromPos(h.token, { key: "cannot-skip", final_deposit_cents: 0, lines: [] }),
    "COUNT_REQUIRED",
  );

  const submitted = await h.svc.submitClosingCount(h.token, { confirm_blanks_zero: true });
  assert.deepEqual(submitted.recorded_as_zero, ["1002"]);
  const draft = h.db.state.closing_drafts.find((row) => row.shift_id === h.shiftId);
  const zero = draft?.counts.find((row) => row.sku === "1002");
  assert.equal(zero?.counted_qty, 0);
  assert.equal(zero?.accepted_as_is, false);
  assert.ok(draft?.closing_submitted_at);

  const blind = await h.svc.state(h.token);
  assert.equal(JSON.stringify(blind.closing).includes("expected"), false);
  const ended = await h.svc.endShiftFromPos(h.token, { key: "confirmed-zero", final_deposit_cents: 0, lines: [] });
  const missing = ended.closing.closing_lines.find((row) => row.sku === "1002");
  assert.equal(missing?.left, 0);
  assert.equal(missing?.variance_qty, -3);
  assert.equal(qty(h.db, "1002"), 0);
  assert.ok(h.db.state.ledger.some((row) => row.sku === "1002" && row.movement_type === "COUNT_VARIANCE" && row.qty_delta === -3));

  const countUi = readFileSync("app/pos/CountCard.tsx", "utf8");
  assert.match(countUi, /items were not counted\. They will be recorded as 0 \(missing\)\. Go back and count, or confirm as 0\?/);
  assert.match(countUi, /data-testid="blank-sku-list"/);
  assert.match(countUi, /data-testid="blank-go-back"/);
  assert.match(countUi, /autoFocus/);
  assert.match(countUi, /data-testid="blank-confirm-zero"/);
  assert.match(countUi, /Every SKU needs a typed number\. Zero is allowed\./);
});

test("the float is stored on the close and does not change the deposit", async () => {
  const h = await readyTill({ "1001": 2 });
  await h.svc.cashout(h.token, { key: "float-sale", lines: [{ sku: "1001", qty: 1 }] });
  const saved = await h.svc.saveFinalDeposit(h.token, { amount_cents: 200, float_cents: 500 });
  assert.equal(saved.final_deposit_cents, 200);
  assert.equal(saved.float_cents, 500);
  const before = h.db.state.deposits.reduce((sum, row) => sum + row.amount_cents, 0);
  await submitClosingValues(h.svc, h.token);
  const ended = await h.svc.endShiftFromPos(h.token, { key: "float-end", final_deposit_cents: 200, float_cents: 500, lines: [] });
  assert.equal(ended.closing.float_cents, 500);
  assert.equal(ended.closing.final_deposit_cents, 200);
  const after = h.db.state.deposits.reduce((sum, row) => sum + row.amount_cents, 0);
  assert.equal(after - before, 200);
  assert.equal(ended.closing.balance_cents, ended.closing.cash_sales_cents + (ended.closing.shortage_cents ?? 0) - (ended.closing.overage_cents ?? 0) - ended.closing.deposited_cents);
  const started = await h.svc.startShift({ key: "float-next", store: "PNY01", staff_ref: "staff-b", pos_id: "B1", shift_id: "sccx-float" });
  const next = await h.svc.login(String(started.pin), "10.9.0.1");
  const open = await h.svc.state(next.token);
  assert.equal(open.float_check.required, true);
  assert.equal(open.float_check.expected_cents, 500);
  assert.equal(open.float_check.done, false);
  const checked = await h.svc.saveOpeningFloat(next.token, { found_cents: 400 });
  assert.equal(checked.gap_cents, -100);
  const verified = await h.svc.state(next.token);
  assert.equal(verified.float_check.done, true);
  assert.equal(verified.float_check.found_cents, 400);
  assert.equal(h.db.state.deposits.reduce((sum, row) => sum + row.amount_cents, 0), after);
});

test("PNY01 NO WEED hides flagged SKUs, preserves their stock through refills, and the next WEED opening owns the variance", async () => {
  const added = `170-28g 170-3g 172-28g 172-3g 187-28g 187-3g 202-14g 202-5g 203-14g 203-5g 204-14g 204-5g 205-5g 216-14g 216-5g 219-14g 219-5g 222-14g 222-5g 224-14g 224-5g 225-14g 225-5g 236-14g 236-5g 261-14g 313-3g 313-5g 315-3g 323-3g 323-5g 328-3g 328-5g 331-3g 331-5g 332-3g 332-5g 337-3g 337-5g 345-3g 345-5g 350-3g 350-5g 373-3g 373-5g 376-3g 376-5g 403-3g 403-5g 404-3g 404-5g 418-3g 418-5g 420-3g 420-5g 424-3g 424-5g 425-3g 425-5g 426-3g 426-5g 427-3g 427-5g 428-3g 430-3g 430-5g 431-3g 431-5g 474-3g 474-5g 499-3g 499-5g 502-3g 502-5g 503-3g 503-5g 506-3g 506-5g 509-3g 509-5g 510-3g 510-5g 511-3g 511-5g 517-3g 517-5g 563-3g 563-5g 921 945 946 947 887 888 889 940 610 611 680 681 960 969`.split(/\s+/);
  assert.equal(added.length, 102);
  assert.equal(THC_SKUS.length, 248);
  assert.equal(new Set(THC_SKUS).size, 248);
  assert.equal(added.every(isThcSku), true);
  assert.equal(isThcSku("188"), true);
  assert.equal(isThcSku("710"), false);
  assert.equal(["240", "668", "669", "710", "1006", "1080"].some(isThcSku), false);
  assert.equal(defaultThcCatalogFlag({ sku: "777-3g", name: "New flower", category: "Flower" }), true);
  assert.equal(defaultThcCatalogFlag({ sku: "1090", name: "New cigarette", category: "Cigarettes" }), false);
  assert.equal(defaultThcCatalogFlag({ sku: "711", name: "New rolling paper", category: "Add Ons" }), false);
  assert.equal(defaultThcCatalogFlag({ sku: "712", name: "New lighter", category: "Add Ons" }), false);
  assert.equal(defaultThcCatalogFlag({ sku: "1082", name: "New nicotine device", category: "Vape Pens" }), false);

  const h = harness();
  await h.svc.syncSetb([
    { sku: "188", name: "Pink Animal pre-roll", category: "Add Ons", price_cents: 500, active: true },
    { sku: "710", name: "Raw paper", category: "Add Ons", price_cents: 250, active: true },
    { sku: "777-3g", name: "New catalog flower", category: "Flower", price_cents: 2500, active: true },
  ]);
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "weed-stock", sku: "188", qty: 4 });
  await h.svc.openingBalance(admin.token, { key: "paper-stock", sku: "710", qty: 3 });
  await h.svc.openingBalance(admin.token, { key: "new-flower-stock", sku: "777-3g", qty: 2 });
  await h.svc.importRoster({
    key: "weed-roster",
    staff: [
      { staff_uid: "staff-a", sccx_id: "a", pos_id: "A1", display_name: "Ada", active: true },
      { staff_uid: "staff-b", sccx_id: "b", pos_id: "B1", display_name: "Bea", active: true },
    ],
  });

  const first = await h.svc.startShift({ key: "weed-start", store: "PNY01", staff_ref: "staff-a", shift_id: "weed-shift" });
  const login = await h.svc.login(String(first.pin), "10.0.0.8");
  const gated = await h.svc.state(login.token);
  assert.equal(gated.phase, "weed");
  assert.equal(gated.weed_gate.required, true);
  assert.equal(gated.can_sell, false);
  assert.equal(gated.shift.opening_confirmed, false);
  await rejects(() => h.svc.cashout(login.token, { key: "skip-gate", lines: [{ sku: "710", qty: 1 }] }), "WEED_ANSWER_REQUIRED");

  const saved = await h.svc.answerWeedInStore(login.token, false);
  assert.equal(saved.weed_in_store, false);
  const shift = h.db.state.shifts.find((row) => row.id === first.shift_id)!;
  assert.equal(shift.weed_answered_by, "staff-a");
  assert.equal(shift.weed_answered_at, h.clock.t.toISOString());
  assert.equal(h.db.state.audit.some((row) => row.action === "WEED_SHIFT_ANSWER" && row.ref_id === first.shift_id), true);

  const noWeed = await h.svc.state(login.token);
  assert.equal(noWeed.weed_gate.answer, false);
  assert.equal(noWeed.products.some((row) => row.sku === "188"), false);
  assert.equal(noWeed.products.some((row) => row.sku === "777-3g"), false);
  assert.equal(noWeed.products.some((row) => row.sku === "710"), true);
  assert.equal(noWeed.verify.lines.some((row) => row.sku === "188"), false);
  assert.equal(noWeed.verify.lines.some((row) => row.sku === "777-3g"), false);
  assert.equal(noWeed.close_lines.some((row) => row.sku === "188"), false);
  assert.equal(noWeed.close_lines.some((row) => row.sku === "777-3g"), false);
  assert.equal(qty(h.db, "188"), 4);
  await rejects(() => h.svc.cashout(login.token, { key: "hidden-thc", lines: [{ sku: "188", qty: 1 }] }), "THC_HIDDEN");

  h.db.state.incoming.push(
    { kitchen_row_id: "weed-refill", batch_id: "batch", store_code: "PNY01", sku: "188", qty_sent: 2, kind: "REFILL", kitchen_created_at: null, imported_at: h.clock.t.toISOString(), status: "PENDING_CONFIRM", qty_received: null, variance_reason: null, confirmed_shift_id: null, confirmed_at: null, linked_ledger_id: null, created_at: h.clock.t.toISOString() },
    { kitchen_row_id: "paper-refill", batch_id: "batch", store_code: "PNY01", sku: "710", qty_sent: 5, kind: "REFILL", kitchen_created_at: null, imported_at: h.clock.t.toISOString(), status: "PENDING_CONFIRM", qty_received: null, variance_reason: null, confirmed_shift_id: null, confirmed_at: null, linked_ledger_id: null, created_at: h.clock.t.toISOString() },
  );
  await h.svc.confirmIncoming(login.token, { key: "receive-both", lines: [
    { kitchen_row_id: "weed-refill", qty_received: 2 },
    { kitchen_row_id: "paper-refill", qty_received: 5 },
  ] });
  assert.equal(qty(h.db, "188"), 6);
  assert.equal(qty(h.db, "710"), 8);
  const afterRefill = await h.svc.state(login.token);
  assert.equal(afterRefill.products.some((row) => row.sku === "188"), false);
  assert.equal(afterRefill.close_lines.some((row) => row.sku === "188"), false);
  assert.equal(afterRefill.products.find((row) => row.sku === "710")?.qty, 8);

  await h.svc.endShiftFromSccx({ key: "weed-off", store: "PNY01", shift_id: "weed-shift", reason: "SCCX_OFF" });
  const firstClosing = h.db.state.closings.find((row) => row.shift_id === first.shift_id)!;
  assert.match(firstClosing.summary_text, /WEED in store this shift: NO WEED/);
  assert.equal(firstClosing.closing_lines.some((row) => row.sku === "188"), false);
  assert.equal(qty(h.db, "188"), 6);

  const next = await h.svc.startShift({ key: "next-weed-start", store: "PNY01", staff_ref: "staff-b", shift_id: "next-weed-shift" });
  const nextLogin = await h.svc.login(String(next.pin), "10.0.0.9");
  await h.svc.answerWeedInStore(nextLogin.token, true);
  const weed = await h.svc.state(nextLogin.token);
  assert.equal(weed.products.find((row) => row.sku === "188")?.qty, 6);
  assert.equal(weed.verify.lines.some((row) => row.sku === "188"), true);
  await h.svc.saveOpeningCount(nextLogin.token, { sku: "188", counted_qty: 5 });
  const opening = h.db.state.closing_drafts.find((row) => row.shift_id === next.shift_id)?.opening_counts?.find((row) => row.sku === "188");
  assert.equal(opening?.expected_qty, 6);
  assert.equal((opening?.counted_qty ?? 0) - (opening?.expected_qty ?? 0), -1);
});

test("a legacy PNY01 shift without the WEED fields still shows THC", async () => {
  const h = harness();
  await h.svc.syncSetb([{ sku: "188", name: "Pink Animal pre-roll", category: "Add Ons", price_cents: 500, active: true }]);
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "legacy-weed-stock", sku: "188", qty: 2 });
  await h.svc.importRoster({ key: "legacy-weed-roster", staff: [{ staff_uid: "legacy-staff", pos_id: "L1", display_name: "Legacy", active: true }] });
  const opened = await h.svc.startShift({ key: "legacy-weed-start", store: "PNY01", staff_ref: "legacy-staff", shift_id: "legacy-weed-shift" });
  const shift = h.db.state.shifts.find((row) => row.id === opened.shift_id)!;
  delete shift.weed_gate_required;
  delete shift.weed_in_store;
  delete shift.weed_answered_at;
  delete shift.weed_answered_by;
  const login = await h.svc.login(String(opened.pin), "10.0.0.10");
  const view = await h.svc.state(login.token);
  assert.equal(view.weed_gate.required, false);
  assert.equal(view.phase, "sell");
  assert.equal(view.products.find((row) => row.sku === "188")?.qty, 2);
  assert.equal(view.verify.lines.some((row) => row.sku === "188"), true);
});

test("POS_Shifts keeps every legacy column in place and appends the WEED fields", () => {
  const legacy = ["row_id", "shift_id", "staff", "pin_hash", "expires_at", "status", "sccx_shift_id", "store_code", "ticket_letter", "started_at", "ended_at", "end_reason", "opening_confirmed_at", "doc"];
  const headers = POS_TAB_SPECS.find((spec) => spec.title === "POS_Shifts")?.headers ?? [];
  assert.deepEqual(headers.slice(0, legacy.length), legacy);
  assert.deepEqual(headers.slice(legacy.length), ["weed_in_store", "weed_answered_at", "weed_answered_by"]);
});

test("PNY02 does not receive the PNY01 WEED gate", async () => {
  const h = harness();
  const opened = await runStore(PNY02_STORE, () => h.svc.openShiftWithPin({ staff_uid: "pny2-staff", display_name: "PNY2 Staff", pin: "2468" }));
  const login = await runStore(PNY02_STORE, () => h.svc.login("2468", "10.0.0.2"));
  const view = await runStore(PNY02_STORE, () => h.svc.state(login.token));
  const shift = h.db.state.shifts.find((row) => row.id === opened.shift_id);
  assert.equal(shift?.weed_gate_required, undefined);
  assert.equal(view.weed_gate.required, false);
  assert.equal(view.phase, "sell");
});
