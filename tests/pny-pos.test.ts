import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { TICKET_LETTERS } from "../app/lib/pny-pos/constants.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { MemoryDb } from "../app/lib/pny-pos/memory.ts";
import { inStockCategories } from "../app/lib/pny-pos/money.ts";
import { SCHEMA_SQL } from "../app/lib/pny-pos/schema.ts";
import { applyDemoSeed } from "../app/lib/pny-pos/seed.ts";
import { catalogFromFeed, DEFAULT_SETB_PRODUCTS_URL, readCommittedPnyCatalog } from "../app/lib/pny-pos/setbFeed.ts";
import { closingBalance, lineVariance } from "../app/lib/pny-pos/closing.ts";
import { END_SHIFT_MESSAGE, PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import type { Secrets } from "../app/lib/pny-pos/types.ts";
import { DEMO_PIN, KITCHEN_PIN } from "../app/lib/pny-pos/constants.ts";
import { demoMode } from "../app/lib/pny-pos/runtime.ts";
import { hideMobileBottomBar } from "../app/lib/mobileBottomBar.ts";

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
  const view = await h.svc.state(login.token);
  await h.svc.openingCount(login.token, {
    key: "opening-a",
    lines: view.count_lines.map((line) => ({ sku: line.sku, counted_qty: line.system_qty })),
  });
  return { ...h, admin: admin.token, token: login.token, pin: String(started.pin), shiftId: String(started.shift_id) };
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

test("5. selling is blocked until the opening count, and a variance needs a reason", async () => {
  const h = harness();
  await h.svc.syncSetb([{ sku: "1001", name: "Flower", category: "Flower", price_cents: 1000, active: true }]);
  const admin = await h.svc.adminLogin(secrets.admin);
  await h.svc.openingBalance(admin.token, { key: "ob", sku: "1001", qty: 4 });
  await h.svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await h.svc.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", shift_id: "sccx-a" });
  const login = await h.svc.login(String(started.pin), "10.0.0.1");
  await rejects(() => h.svc.cashout(login.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] }), "OPENING_REQUIRED");
  await rejects(
    () => h.svc.openingCount(login.token, { key: "bad-count", lines: [{ sku: "1001", counted_qty: 3 }] }),
    "REASON_REQUIRED",
  );
  assert.equal(qty(h.db, "1001"), 4);
  await h.svc.openingCount(login.token, { key: "bad-count", lines: [{ sku: "1001", counted_qty: 3, variance_reason: "one short" }] });
  assert.equal(qty(h.db, "1001"), 3);
  assert.equal(h.db.state.ledger.some((row) => row.movement_type === "COUNT_VARIANCE"), true);
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

test("9. a deposit above cash on hand is rejected and header totals follow sale, deposit and void", async () => {
  const h = await readyTill();
  await h.svc.cashout(h.token, { key: "sale", lines: [{ sku: "1001", qty: 1 }] });
  await rejects(() => h.svc.deposit(h.token, { key: "too-much", amount_cents: 1001 }), "OVER_COH");
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
  assert.equal(shown.prices_include_tax, true);
  const names = keysDeep(shown);
  for (const banned of ["qty", "quantity", "on_hand", "pin", "balance", "ledger", "deposited", "cash_on_hand", "staff_uid"]) {
    assert.equal(names.has(banned), false, banned);
  }
  assert.deepEqual(inStockCategories([{ category: "Vape", qty: 0 }, { category: "Flower", qty: 2 }, { category: "Edible", qty: 1 }]), ["Edible", "Flower"]);
});

test("12. a kitchen allocation is incoming and not sellable until it is confirmed", async () => {
  const h = await readyTill({ "1001": 1, "1002": 0 });
  const rowId = crypto.randomUUID();
  h.sheet.tabs.K_Allocations = [{ row_id: rowId, batch_id: "b1", store_code: "PNY01", kind: "ALLOCATION", sku: "1001", qty: "3", created_at: "2026-11-03T15:00:00+07:00", kitchen_status: "ACTIVE" }];
  const imported = await h.svc.refreshIncoming({ force: true });
  assert.equal(imported.imported, 1);
  assert.equal(qty(h.db, "1001"), 1);
  assert.equal(h.db.state.incoming[0]?.status, "PENDING_CONFIRM");
  await rejects(() => h.svc.cashout(h.token, { key: "blocked", lines: [{ sku: "1001", qty: 1 }] }), "REFILL_REQUIRED");
  assert.equal(qty(h.db, "1001"), 1);
  await h.svc.confirmIncoming(h.token, { key: "confirm-1", lines: [{ kitchen_row_id: rowId, qty_received: 3 }] });
  assert.equal(qty(h.db, "1001"), 4);
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
  await rejects(() => h.svc.confirmIncoming(h.token, { key: "partial-bad", lines: [{ kitchen_row_id: rowId, qty_received: 1 }] }), "REASON_REQUIRED");
  assert.equal(qty(h.db, "1001"), 0);
  await h.svc.confirmIncoming(h.token, { key: "partial-ok", lines: [{ kitchen_row_id: rowId, qty_received: 1, variance_reason: "short case" }] });
  assert.equal(qty(h.db, "1001"), 1);
  const receipt = h.db.state.outbox.find((row) => row.row_id === `R-${rowId}`);
  assert.equal(receipt?.payload.status, "PARTIAL");
  assert.equal(receipt?.payload.variance, "-3");
  assert.equal(receipt?.payload.variance_reason, "short case");
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
  h.sheet.reachable = false;
  await h.svc.openingCount(login.token, { key: "count", lines: [{ sku: "1001", counted_qty: 4 }] });
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
  assert.match(posApp, /isFlowerCategory/);
  assert.match(posApp, /data-layout="list"/);
  assert.match(posApp, /data-count=\{stockCount\(chip\)\}/);
  assert.match(posApp, /product\.qty > 0 && \(name === "All" \|\| product\.category === name\)/);
  assert.doesNotMatch(posApp.split('data-layout="list"')[0]?.split("isFlowerCategory(product.category)")[1] ?? "", /ProductPhoto/);
  assert.match(posApp, /href="\/pos\/till"/);
  assert.match(posApp, /End Shift/);
  assert.doesNotMatch(posApp, /data-testid="total-sales"/);
  assert.doesNotMatch(posApp, /\+Deposit/);
  assert.match(tillApp, /data-testid="total-sales"/);
  assert.match(tillApp, /data-testid="cash-on-hand"/);
  assert.match(tillApp, /\+Deposit/);
  assert.match(tillApp, />Back</);
  assert.match(menuApp, /listRow/);
  assert.match(menuApp, /aria-label="Categories"/);
  assert.doesNotMatch(menuApp, /on_hand|item\.qty|product\.qty/);
  const menuCss = readFileSync("app/menu/menu.module.css", "utf8");
  assert.match(menuCss, /grid-template-columns:\s*1fr 1fr/);
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

test("preview without a database uses the labeled demo and production with a database does not", () => {
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    PNY_POS_DEMO: process.env.PNY_POS_DEMO,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
  try {
    delete process.env.DATABASE_URL;
    delete process.env.PNY_POS_DEMO;
    process.env.VERCEL_ENV = "preview";
    assert.equal(demoMode(), true);
    process.env.VERCEL_ENV = "production";
    assert.equal(demoMode(), true);
    process.env.DATABASE_URL = "postgres://production.example/pny";
    assert.equal(demoMode(), false);
    process.env.PNY_POS_DEMO = "1";
    assert.equal(demoMode(), false);
    process.env.PNY_POS_DEMO = "0";
    assert.equal(demoMode(), false);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("SETB feed mapping keeps real SKUs and images and drops on-hand", () => {
  const rows = catalogFromFeed({
    flowers: [{ sku: "490", name: "PINK JOKER", tier: "PREMIUM", price3g: { regular: 30, sale: null }, price5g: { regular: 45, sale: 40 }, image: "https://cdn.example/pink.webp", on_hand: 99, qty: 4 }],
    items: [
      { sku: "613, 614", name: "STELLAR GUMMIES", category: "EDIBLES", price: "$40 / $55", image: "https://cdn.example/stellar.webp", stock: 12 },
      { sku: "392", name: "SECOND", tier: "BUDGET", price5g: { regular: 10, sale: null }, image: "https://cdn.example/second.webp" },
    ],
  });
  const flower = rows.find((row) => row.sku === "490");
  assert.equal(flower?.price_cents, 3000);
  assert.equal(flower?.image_url, "https://cdn.example/pink.webp");
  assert.equal(flower?.category, "PREMIUM");
  assert.equal(rows.filter((row) => row.sku === "392").length, 1);
  assert.deepEqual(rows.filter((row) => row.sku === "613" || row.sku === "614").map((row) => row.price_cents), [4000, 5500]);
  assert.equal(JSON.stringify(rows).includes("on_hand"), false);
  assert.equal(JSON.stringify(rows).includes("\"stock\""), false);
  const committed = catalogFromFeed(readCommittedPnyCatalog());
  assert.ok(committed.some((row) => row.sku === "490" && row.name === "PINK JOKER" && row.image_url?.startsWith("https://")));
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
  assert.equal(menu.items?.some((item) => item.sku === "490" && item.name === "PINK JOKER"), true);
  assert.equal(menu.items?.every((item) => item.availability === "Available" && typeof item.image_url === "string" && item.image_url.length > 0), true);
  assert.equal(menu.items?.some((item) => item.category === "CIGARETTES"), false);
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
