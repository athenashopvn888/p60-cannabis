import assert from "node:assert/strict";
import test from "node:test";
import { KITCHEN_PIN } from "../app/lib/pny-pos/constants.ts";
import { hashPin } from "../app/lib/pny-pos/crypto.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { kitchenPinMatches, kitchenWritesEnabled } from "../app/lib/pny-pos/kitchenAuth.ts";
import { needsLargeConfirm, parseKitchenRefill } from "../app/lib/pny-pos/kitchenBatch.ts";
import { MemoryDb } from "../app/lib/pny-pos/memory.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import type { Secrets } from "../app/lib/pny-pos/types.ts";

const secrets: Secrets = {
  shift: "test-shift-secret-value",
  roster: "test-roster-secret-value",
  poll: "test-poll-secret-value",
  session: "test-session-secret-value-32chars",
  admin: "test-admin-secret-value",
  cron: "test-cron-secret-value",
};

function qty(db: MemoryDb, sku: string) {
  return db.state.balances.find((row) => row.sku === sku)?.qty ?? 0;
}

async function rejects(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof PosError);
    assert.equal((error as PosError).code, code);
    return true;
  });
}

async function openTill() {
  const db = new MemoryDb();
  const svc = new PosService(db, { now: () => new Date("2026-11-12T18:00:00.000Z"), sheet: new LocalSheet(), secrets, demo: null });
  await svc.syncSetb([
    { sku: "170-3g", name: "Jokerz", category: "Flower", price_cents: 1000, active: true },
    { sku: "1002", name: "Gummy", category: "Edible", price_cents: 500, active: true },
  ]);
  const admin = await svc.adminLogin(secrets.admin);
  await svc.openingBalance(admin.token, { key: "ob-170", sku: "170-3g", qty: 2 });
  await svc.openingBalance(admin.token, { key: "ob-1002", sku: "1002", qty: 4 });
  await svc.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", sccx_id: "a", pos_id: "A1", display_name: "Ada", active: true }] });
  const started = await svc.startShift({ key: "start-a", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "sccx-a" });
  const login = await svc.login(String(started.pin), "10.1.0.1");
  await svc.answerWeedInStore(login.token, true);
  await svc.state(login.token);
  const kitchen = await svc.enterKitchen(KITCHEN_PIN, "10.1.0.2");
  return { db, svc, staff: login.token, kitchen: kitchen.token, pin: String(started.pin) };
}

test("kitchen PIN is the TEMP hash and is not a till PIN", async () => {
  assert.equal(kitchenPinMatches(KITCHEN_PIN), true);
  assert.equal(kitchenPinMatches("1988"), false);
  assert.equal(kitchenWritesEnabled(), false);
  const h = await openTill();
  await rejects(() => h.svc.login(KITCHEN_PIN, "10.1.0.3"), "BAD_PIN");
  const shift = h.db.state.shifts.find((row) => row.status === "ACTIVE");
  assert.ok(shift);
  shift.pin_hash = hashPin(KITCHEN_PIN);
  await rejects(() => h.svc.login(KITCHEN_PIN, "10.1.0.4"), "BAD_PIN");
  await rejects(() => h.svc.cashout(h.kitchen, { key: "no-sale", lines: [{ sku: "1002", qty: 1 }] }), "NO_SESSION");
  await rejects(() => h.svc.state(h.kitchen), "NO_SESSION");
  await rejects(() => h.svc.state(h.kitchen, undefined, "kitchen"), "NO_SESSION");
  await rejects(() => h.svc.endShiftFromPos(h.kitchen, { key: "no-end", lines: [] }), "NO_SESSION");
  const before = qty(h.db, "1002");
  await h.svc.cashout(h.staff, { key: "staff-sale", lines: [{ sku: "1002", qty: 1 }] });
  assert.equal(qty(h.db, "1002"), before - 1);
});

test("refill paste reads sku, size, and qty", () => {
  const parsed = parseKitchenRefill("170, 3g, 2\n1001 4\nsku,size,qty\nbad line");
  assert.deepEqual(parsed.lines.map((line) => [line.sku, line.qty]), [["170-3g", 2], ["1001", 4]]);
  assert.equal(parsed.errors.length, 1);
  assert.equal(needsLargeConfirm(1, 517), true);
  assert.equal(needsLargeConfirm(10, 2), false);
});

test("preview dry-run writes nothing and a duplicate batch is rejected", async () => {
  const h = await openTill();
  const before = structuredClone({
    qty: qty(h.db, "170-3g"),
    shifts: h.db.state.shifts,
    sales: h.db.state.sales,
    deposits: h.db.state.deposits,
    counts: h.db.state.counts,
    closings: h.db.state.closings,
    staff: h.db.state.staff,
  });
  const preview = await h.svc.kitchenRefill(h.kitchen, { text: "170, 3g, 3", confirm: false });
  assert.equal(preview.dry_run, true);
  assert.equal(preview.lines[0]?.sku, "170-3g");
  assert.equal(preview.lines[0]?.before, 2);
  assert.equal(preview.lines[0]?.after, 5);
  const confirmed = await h.svc.kitchenRefill(h.kitchen, { text: "170, 3g, 3", batch_id: preview.batch_id, confirm: true });
  assert.equal(confirmed.dry_run, true);
  assert.equal(qty(h.db, "170-3g"), before.qty);
  assert.equal(h.db.state.audit.some((row) => row.action === "KITCHEN_REFILL"), false);
  assert.equal(h.db.state.incoming.length, 0);
  assert.deepEqual(h.db.state.shifts, before.shifts);
  assert.deepEqual(h.db.state.sales, before.sales);
  assert.deepEqual(h.db.state.deposits, before.deposits);
  assert.deepEqual(h.db.state.counts, before.counts);
  assert.deepEqual(h.db.state.closings, before.closings);
  assert.deepEqual(h.db.state.staff, before.staff);

  process.env.VERCEL_ENV = "preview";
  process.env.PNY_KITCHEN_WRITES = "1";
  try {
    const flagged = await h.svc.kitchenRefill(h.kitchen, { text: "170, 3g, 3", confirm: true });
    assert.equal(flagged.dry_run, true);
    assert.equal(qty(h.db, "170-3g"), before.qty);
  } finally {
    delete process.env.VERCEL_ENV;
    delete process.env.PNY_KITCHEN_WRITES;
  }
});

test("a real refill is once-only, undo puts the shelf back, and a NO WEED shift still stores THC", async () => {
  const h = await openTill();
  await h.svc.answerWeedInStore(h.staff, false);
  const hidden = await h.svc.state(h.staff);
  assert.equal(hidden.products?.some((row) => row.sku === "170-3g"), false);
  const pin = h.db.state.shifts.find((row) => row.status === "ACTIVE")?.pin_hash;
  const sales = h.db.state.sales.length;
  const deposits = h.db.state.deposits.length;
  const counts = h.db.state.counts.length;
  const closings = h.db.state.closings.length;

  process.env.VERCEL_ENV = "production";
  process.env.PNY_KITCHEN_WRITES = "1";
  try {
    const preview = await h.svc.kitchenRefill(h.kitchen, { text: "170-3g 2", confirm: false });
    assert.equal(preview.no_weed, true);
    assert.equal(preview.lines[0]?.thc, true);
    const saved = await h.svc.kitchenRefill(h.kitchen, { text: "170-3g 2", batch_id: preview.batch_id, confirm: true });
    assert.equal(saved.dry_run, false);
    assert.equal(qty(h.db, "170-3g"), 4);
    assert.equal(h.db.state.incoming[0]?.status, "CONFIRMED");
    assert.equal(h.db.state.incoming[0]?.qty_received, 2);
    assert.equal(h.db.state.ledger.some((row) => row.movement_type === "INCOMING_CONFIRM" && row.actor === "KITCHEN"), true);
    const stillHidden = await h.svc.state(h.staff);
    assert.equal(stillHidden.products?.some((row) => row.sku === "170-3g"), false);
    const shelf = await h.svc.kitchenStock(h.kitchen);
    assert.equal(shelf.rows.find((row) => row.sku === "170-3g")?.on_hand, 4);
    await rejects(() => h.svc.kitchenRefill(h.kitchen, { text: "170-3g 2", batch_id: "other-batch", confirm: true }), "DUPLICATE_REFILL");
    assert.equal(qty(h.db, "170-3g"), 4);
    const undone = await h.svc.kitchenUndo(h.kitchen, { batch_id: preview.batch_id, confirm: true });
    assert.equal(undone.dry_run, false);
    assert.equal(qty(h.db, "170-3g"), 2);
    assert.equal(h.db.state.incoming[0]?.status, "REJECTED");
    assert.equal(h.db.state.incoming[0]?.qty_received, 0);
    const net = h.db.state.ledger.filter((row) => row.sku === "170-3g" && row.actor === "KITCHEN").reduce((sum, row) => sum + row.qty_delta, 0);
    assert.equal(net, 0);
    await rejects(() => h.svc.kitchenUndo(h.kitchen, { batch_id: preview.batch_id, confirm: true }), "ALREADY_UNDONE");

    await rejects(() => h.svc.kitchenAdjust(h.kitchen, { sku: "1002", delta: 517, reason: "recount", confirm: true }), "LARGE_QTY");
    assert.equal(qty(h.db, "1002"), 4);
    const adjusted = await h.svc.kitchenAdjust(h.kitchen, { sku: "1002", delta: -1, reason: "damaged", note: "crushed", confirm: true });
    assert.equal(adjusted.dry_run, false);
    assert.equal(qty(h.db, "1002"), 3);
    await h.svc.kitchenUndo(h.kitchen, { batch_id: adjusted.batch_id, confirm: true });
    assert.equal(qty(h.db, "1002"), 4);
  } finally {
    delete process.env.VERCEL_ENV;
    delete process.env.PNY_KITCHEN_WRITES;
  }

  const shift = h.db.state.shifts.find((row) => row.status === "ACTIVE");
  assert.equal(shift?.pin_hash, pin);
  assert.equal(shift?.weed_in_store, false);
  assert.equal(h.db.state.sales.length, sales);
  assert.equal(h.db.state.deposits.length, deposits);
  assert.equal(h.db.state.counts.length, counts);
  assert.equal(h.db.state.closings.length, closings);
});
