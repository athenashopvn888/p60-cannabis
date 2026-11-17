import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNTANT_CC, ACCOUNTANT_EMAIL, closingEmailPayload, ensureRefillId, refillEmailPayload } from "../app/lib/pny-pos/accountantEmail.ts";
import { accountantEmailWebhookConfigured, deliverAccountantEmail } from "../app/lib/pny-pos/accountantEmailDelivery.ts";
import { buildStockClosingReport } from "../app/lib/pny-pos/stockClosingReport.ts";
import ExcelJS from "exceljs";
import { emptyState, MemoryDb } from "../app/lib/pny-pos/memory.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import type { ClosingRow, IncomingRow, Secrets, ShiftRow } from "../app/lib/pny-pos/types.ts";

const at = "2026-11-17T15:00:00.000Z";

test("refill IDs are simple, sequential, and shared by every line in a batch", () => {
  const state = emptyState(at);
  const first = ensureRefillId(state, "batch-a", "PNY01");
  state.incoming.push({ batch_id: "batch-a", refill_id: first } as IncomingRow);
  assert.equal(first, "PNY01-R0001");
  assert.equal(ensureRefillId(state, "batch-a", "PNY01"), "PNY01-R0001");
  assert.equal(ensureRefillId(state, "batch-b", "PNY01"), "PNY01-R0002");
});

test("refill emails contain the complete line list and use Doli's address", () => {
  const state = emptyState(at);
  state.products.push(
    { sku: "488", name: "Premium Pink", category: "PreRoll", default_price_cents: 1200 } as never,
    { sku: "655", name: "Knock Out LW", category: "Edible", default_price_cents: 2500 } as never,
  );
  const rows = [
    { refill_id: "PNY01-R0007", batch_id: "batch-7", store_code: "PNY01", sku: "488", qty_sent: 20, created_by: "Kitchen" },
    { refill_id: "PNY01-R0007", batch_id: "batch-7", store_code: "PNY01", sku: "655", qty_sent: 2, created_by: "Kitchen" },
  ] as IncomingRow[];
  const payload = refillEmailPayload(state, rows, "SENT", at);
  assert.equal(payload.to, ACCOUNTANT_EMAIL);
  assert.equal(payload.cc, ACCOUNTANT_CC);
  assert.match(payload.subject, /PNY01-R0007 SENT/);
  assert.match(payload.body, /488 \| Premium Pink \| sent 20/);
  assert.match(payload.body, /655 \| Knock Out LW \| sent 2/);
  assert.match(payload.body, /Units sent: 22/);
});

test("closing email includes sold items, every positive on-hand SKU, and total units", () => {
  const state = emptyState(at);
  state.products.push(
    { sku: "240", name: "Grabba", category: "Add Ons", default_price_cents: 500 } as never,
    { sku: "655", name: "Knock Out LW", category: "Edible", default_price_cents: 2500 } as never,
    { sku: "999", name: "Zero", category: "Edible", default_price_cents: 100 } as never,
  );
  state.balances.push(
    { sku: "240", qty: 7, updated_at: at, created_at: at },
    { sku: "655", qty: 2, updated_at: at, created_at: at },
    { sku: "999", qty: 0, updated_at: at, created_at: at },
  );
  state.staff.push({ staff_uid: "staff-a", pos_id: "A1", display_name: "Randy" } as never);
  state.sales.push({ id: "sale-1", shift_id: "shift-a", status: "COMPLETED" } as never);
  state.sale_lines.push({ id: "line-1", sale_id: "sale-1", sku: "240", qty: 3 } as never);
  const shift = { id: "shift-a", staff_uid: "staff-a", store_code: "PNY01", started_at: at, ended_at: at } as ShiftRow;
  const closing = {
    sales_total_cents: 10000,
    sale_count: 2,
    deposited_cents: 10000,
    balance_cents: 0,
  } as ClosingRow;
  const payload = closingEmailPayload(state, shift, closing, at);
  assert.equal(payload.to, ACCOUNTANT_EMAIL);
  assert.equal(payload.cc, ACCOUNTANT_CC);
  assert.match(payload.body, /SOLD THIS SHIFT \(1 SKUs\)/);
  assert.match(payload.body, /240 \| Grabba \| 3/);
  assert.match(payload.body, /Total sold units: 3/);
  assert.match(payload.body, /ON HAND STOCK \(2 SKUs\)/);
  assert.match(payload.body, /240 \| Grabba \| 7/);
  assert.match(payload.body, /655 \| Knock Out LW \| 2/);
  assert.doesNotMatch(payload.body, /999 \| Zero/);
  assert.match(payload.body, /Total on-hand units: 9/);
  assert.match(String(payload.attachment_name), /^PNY01-Stock-Closing-2026-11-17-Randy\.xlsx$/);
  assert.ok(payload.attachment_report_json);
});

test("stock closing workbook preserves the accountant layout and adds R after A", async () => {
  const buffer = await buildStockClosingReport({
    storeCode: "PNY01",
    staffName: "Randy",
    closeDate: at,
    closing: {
      sales_total_cents: 79300,
      debit_sales_cents: 500,
      deposited_cents: 92000,
      float_cents: 4400,
      overage_cents: 10800,
      balance_cents: -3450,
      closing_lines: [
        { sku: "172-3g", name: "Lavender Kush", opening_qty: 10, received_qty: 2, sold_qty: 3, left: 9, system_qty: 9 },
        { sku: "396-6g", name: "Khalifa Kush", opening_qty: 4, received_qty: 1, sold_qty: 2, left: 3, system_qty: 3 },
        { sku: "655", name: "Knock Out LW", opening_qty: 2, received_qty: 2, sold_qty: 1, left: 3, system_qty: 3 },
      ],
    },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("STOCK CLOSING REPORT");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "STOCK CLOSING REPORT");
  assert.equal(sheet.getCell("A9").value, "A = Assigned     R = Confirmed refill     S = Sold     OH = Onhand");
  assert.deepEqual([2, 3, 4, 5].map((column) => sheet.getCell(11, column).value), ["A", "R", "S", "OH"]);
  assert.equal(sheet.getCell("A12").value, "172");
  assert.deepEqual([2, 3, 4, 5].map((column) => sheet.getCell(12, column).value), [10, 2, 3, 9]);
  assert.equal(sheet.getCell("A13").value, "396");
  assert.deepEqual([6, 7, 8, 9].map((column) => sheet.getCell(13, column).value), [4, 1, 2, 3]);
  assert.equal(sheet.getCell("A14").value, "655");
  assert.deepEqual([18, 19, 20, 21].map((column) => sheet.getCell(14, column).value), [2, 2, 1, 3]);
});

test("direct accountant email sender posts the complete payload", async () => {
  const oldUrl = process.env.PNY_EMAIL_WEBHOOK_URL;
  const oldSecret = process.env.PNY_EMAIL_WEBHOOK_SECRET;
  const oldFetch = global.fetch;
  process.env.PNY_EMAIL_WEBHOOK_URL = "https://example.invalid/pny-email";
  process.env.PNY_EMAIL_WEBHOOK_SECRET = "test-secret";
  let posted = {} as Record<string, string>;
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    posted = JSON.parse(String(init?.body || "{}")) as Record<string, string>;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(accountantEmailWebhookConfigured(), true);
    await deliverAccountantEmail({
      row_id: "EMAIL-CLOSE-1",
      to: ACCOUNTANT_EMAIL,
      cc: ACCOUNTANT_CC,
      subject: "Close",
      body: "ON HAND STOCK",
      attachment_name: "PNY01-Stock-Closing.xlsx",
      attachment_report_json: JSON.stringify({
        storeCode: "PNY01",
        staffName: "Randy",
        closeDate: at,
        closing: {
          sales_total_cents: 1000,
          debit_sales_cents: 0,
          deposited_cents: 1000,
          float_cents: 0,
          overage_cents: 0,
          balance_cents: 0,
          closing_lines: [{ sku: "655", name: "Knock Out LW", left: 2, system_qty: 2, opening_qty: 1, received_qty: 2, sold_qty: 1 }],
        },
      }),
    });
    assert.equal(posted.to, ACCOUNTANT_EMAIL);
    assert.equal(posted.cc, ACCOUNTANT_CC);
    assert.equal(posted.body, "ON HAND STOCK");
    assert.equal(posted.secret, "test-secret");
    assert.equal(posted.attachment_name, "PNY01-Stock-Closing.xlsx");
    assert.equal(posted.attachment_mime, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.ok(posted.attachment_base64.length > 1000);
  } finally {
    global.fetch = oldFetch;
    if (oldUrl == null) delete process.env.PNY_EMAIL_WEBHOOK_URL;
    else process.env.PNY_EMAIL_WEBHOOK_URL = oldUrl;
    if (oldSecret == null) delete process.env.PNY_EMAIL_WEBHOOK_SECRET;
    else process.env.PNY_EMAIL_WEBHOOK_SECRET = oldSecret;
  }
});

test("Kitchen import and staff receive queue SENT and RECEIVED emails and return a receipt", async () => {
  const secrets: Secrets = { shift: "shift", roster: "roster", poll: "poll", session: "session-secret-32-characters-long", admin: "admin", cron: "cron" };
  const sheet = new LocalSheet();
  const db = new MemoryDb();
  const service = new PosService(db, { now: () => new Date(at), sheet, secrets, demo: null });
  await service.syncSetb([{ sku: "655", name: "Knock Out LW", category: "Edible", price_cents: 2500, active: true }]);
  const admin = await service.adminLogin(secrets.admin);
  await service.openingBalance(admin.token, { key: "opening", sku: "655", qty: 0 });
  await service.importRoster({ key: "roster", staff: [{ staff_uid: "staff-a", pos_id: "A1", display_name: "Randy", active: true }] });
  const started = await service.startShift({ key: "start", store: "PNY01", staff_ref: "staff-a", pos_id: "A1", shift_id: "sccx-a" });
  const login = await service.login(String(started.pin), "127.0.0.1");
  await service.answerWeedInStore(login.token, true);
  await service.state(login.token);
  const rowId = "11111111-1111-4111-8111-111111111111";
  sheet.tabs.K_Allocations = [{
    row_id: rowId,
    batch_id: "kitchen-batch-1",
    store_code: "PNY01",
    sku: "655",
    qty: "2",
    kind: "REFILL",
    created_by: "Kitchen One",
    created_at: at,
  }];
  await service.refreshIncoming({ force: true });
  const view = await service.state(login.token);
  assert.equal(view.incoming[0]?.refill_id, "PNY01-R0001");
  const received = await service.confirmIncoming(login.token, { key: "receive", lines: [{ kitchen_row_id: rowId, qty_received: 2 }] });
  assert.equal(received.receipts[0]?.staff_name, db.state.staff.find((row) => row.staff_uid === "staff-a")?.display_name);
  assert.equal(received.receipts[0]?.lines[0]?.qty_received, 2);
  const emailRows = db.state.outbox.filter((row) => row.tab === "S_EmailOutbox");
  assert.deepEqual(emailRows.map((row) => row.payload.status).sort(), ["PENDING", "PENDING"]);
  assert.ok(emailRows.some((row) => row.payload.subject.includes("SENT")));
  assert.ok(emailRows.some((row) => row.payload.subject.includes("RECEIVED")));
  const oldReadOnly = process.env.PNY_SHEET_READ_ONLY;
  const oldEmailEnabled = process.env.PNY_EMAIL_OUTBOX_ENABLED;
  process.env.PNY_SHEET_READ_ONLY = "1";
  process.env.PNY_EMAIL_OUTBOX_ENABLED = "1";
  try {
    const drained = await service.drainOutbox();
    assert.equal(drained.sent, 2);
    assert.equal(sheet.tabs.S_EmailOutbox?.length, 2);
    assert.ok(db.state.outbox.some((row) => row.tab !== "S_EmailOutbox" && row.status === "queued"));
  } finally {
    if (oldReadOnly == null) delete process.env.PNY_SHEET_READ_ONLY;
    else process.env.PNY_SHEET_READ_ONLY = oldReadOnly;
    if (oldEmailEnabled == null) delete process.env.PNY_EMAIL_OUTBOX_ENABLED;
    else process.env.PNY_EMAIL_OUTBOX_ENABLED = oldEmailEnabled;
  }
});
