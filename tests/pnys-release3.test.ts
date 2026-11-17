import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Release 3 reconciliation ties stock and cash and leaves float undecided", async () => {
  const report = JSON.parse(await readFile("reports/pnys-release3/reconciliation.json", "utf8"));
  assert.equal(report.scope, "isolated in-memory PNYS preview fixture; no production or preview database rows persisted");
  assert.equal(report.mode.default, "WEED");
  assert.equal(report.mode.final, "NO_WEED");
  assert.equal(report.mode.scope, "STORE");
  assert.equal(report.mode.survives_shift_close, true);
  assert.equal(report.mode.thc_sale_blocked, true);
  assert.equal(report.customer_sale.total_cents, 4000);
  assert.equal(report.customer_sale.discount_cents, 1000);
  assert.deepEqual(report.refill, { batch_id: report.refill.batch_id, sku: "9902", sent: 3, confirmed: 3 });
  for (const row of report.stock) assert.equal(row.opening + row.refills - row.sales, row.expected);
  for (const row of report.stock) assert.equal(row.expected + row.variance, row.counted);
  assert.equal(report.stock.find((row: { sku: string }) => row.sku === "9902").variance, -1);
  assert.equal(report.closing.shortage_cents, 2500);
  assert.equal(report.cash.cash_sales_cents - report.cash.deposited_cents - report.cash.end_float_cents, 0);
  assert.match(report.opening_float_formula, /ACCOUNTANT DECISION REQUIRED/);
  assert.equal(report.closing.manager_report_found, true);
});

test("Release 3 proof route is preview-only and contains all six phone screens", async () => {
  const page = await readFile("app/pos/dry-run-preview/page.tsx", "utf8");
  const proof = await readFile("app/pos/dry-run-preview/DryRunProof.tsx", "utf8");
  assert.match(page, /VERCEL_ENV === "production"/);
  for (const step of ["login", "sale", "refill", "mode", "closing", "manager"]) assert.match(proof, new RegExp(`"${step}"`));
});

test("Release 3 cleanup is tightly guarded", async () => {
  const undo = await readFile("supabase/undo/20261114150000_pnys_release3_dry_run.undo.sql", "utf8");
  assert.match(undo, /RELEASE3-/);
  assert.doesNotMatch(undo, /delete from pny_pos\./);
  assert.doesNotMatch(undo, /update pny_pos\./);
});
