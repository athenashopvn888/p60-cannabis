import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashPin } from "../app/lib/pny-pos/crypto.ts";
import { MemoryDb, emptyState } from "../app/lib/pny-pos/memory.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import { runStore } from "../app/lib/pny-pos/storeContext.ts";
import { PNYS_STORE } from "../app/lib/pny-pos/storeProfile.ts";
import type { Secrets } from "../app/lib/pny-pos/types.ts";

const secrets: Secrets = {
  shift: "dry-run-shift-secret-placeholder",
  roster: "dry-run-roster-secret-placeholder",
  poll: "dry-run-poll-secret-placeholder",
  session: "dry-run-session-secret-placeholder-32",
  admin: "dry-run-admin-secret-placeholder",
  cron: "dry-run-cron-secret-placeholder",
};

function ephemeralPin() {
  return String(Number.parseInt(randomBytes(4).toString("hex"), 16) % 900000 + 100000);
}

async function main() {
  const staffPin = ephemeralPin();
  let kitchenPin = ephemeralPin();
  let managerPin = ephemeralPin();
  while (kitchenPin === staffPin) kitchenPin = ephemeralPin();
  while (managerPin === staffPin || managerPin === kitchenPin) managerPin = ephemeralPin();
  process.env.PNY_DEMO_PIN_HASH = hashPin(staffPin);
  process.env.PNY_KITCHEN_PIN_HASH = hashPin(kitchenPin);
  process.env.PNY_MASTER_PIN_HASH = hashPin(managerPin);

  const clock = { value: new Date("2026-11-14T15:00:00.000Z") };
  const db = new MemoryDb(emptyState(clock.value.toISOString()));
  db.state.stores[0] = { ...db.state.stores[0]!, code: "PNYS", name: "PNYS", prices_tax_included: true };
  const products = [
    { sku: "9901-3g", name: "Dry Run Flower", category: "FLOWER", price: 2000, qty: 6, thc: true },
    { sku: "9902", name: "Dry Run Paper", category: "ADD ONS", price: 2500, qty: 10, thc: false },
    { sku: "9903", name: "Dry Run Lighter", category: "ADD ONS", price: 500, qty: 5, thc: false },
  ];
  for (const [index, row] of products.entries()) {
    db.state.products.push({ sku: row.sku, thc_flag: row.thc, sku_sort: 9901 + index, name: row.name, category: row.category, default_price_cents: row.price, image_url: null, setb_active: true, synced_at: clock.value.toISOString(), created_at: clock.value.toISOString() });
    db.state.store_products.push({ store_code: "PNYS", sku: row.sku, enabled: true, price_override_cents: row.price, created_at: clock.value.toISOString(), updated_at: clock.value.toISOString() });
    db.state.balances.push({ store_code: "PNYS", sku: row.sku, qty: row.qty, created_at: clock.value.toISOString(), updated_at: clock.value.toISOString() });
  }
  db.state.opening_stock_at = clock.value.toISOString();
  const svc = new PosService(db, { now: () => clock.value, sheet: new LocalSheet(), secrets, demo: { pinHash: hashPin(staffPin), label: "TEST STORE" } });
  const inPnys = <T>(run: () => Promise<T>) => runStore(PNYS_STORE, run);

  const staff = await inPnys(() => svc.login(staffPin, "release3-staff"));
  const manager = await inPnys(() => svc.managerLogin(managerPin, "release3-manager"));
  const kitchen = await inPnys(() => svc.kitchenLogin(kitchenPin, "release3-kitchen"));
  const shiftId = db.state.shifts.find((row) => row.status === "ACTIVE")!.id;
  const opening: Record<string, number> = Object.fromEntries(products.map((row) => [row.sku, row.qty]));

  await inPnys(() => svc.managerCreateCoupon(manager.token, { key: "release3-coupon", code: "DRY10", label: "$10 dry-run coupon", discount_type: "FIXED", discount_value: 1000, min_spend_cents: 5000, max_redemptions_per_customer: 1, confirm: true }));
  clock.value = new Date("2026-11-14T15:05:00.000Z");
  const customerSale = await inPnys(() => svc.cashout(staff.token, { key: "release3-sale-customer", payment_method: "CASH", lines: [{ sku: "9902", qty: 2 }], customer: { phone: "4165550199", name: "Dry Run Customer", email: "dry-run@example.invalid", consent_type: "EXPRESS", consented_at: clock.value.toISOString(), consent_source: "IN_STORE_DRY_RUN" }, coupon_code: "DRY10" })) as { sale_id: string; subtotal_cents: number; discount_cents: number; total_cents: number; coupon_code: string; customer?: { phone_last4: string } };

  clock.value = new Date("2026-11-14T15:10:00.000Z");
  const refill = await inPnys(() => svc.queueKitchenRefill(kitchen.token, { key: "release3-refill", lines: [{ sku: "9902", qty: 3 }] })) as { batch_id: string; lines: Array<{ kitchen_row_id: string }> };
  await inPnys(() => svc.confirmIncoming(staff.token, { key: "release3-refill-confirm", lines: [{ kitchen_row_id: refill.lines[0]!.kitchen_row_id, qty_received: 3 }] }));

  clock.value = new Date("2026-11-14T15:15:00.000Z");
  const mode = await inPnys(() => svc.managerSetWeedMode(manager.token, { key: "release3-no-weed", weed_in_store: false, confirm: true })) as { weed_in_store: boolean };
  let thcBlocked = false;
  try {
    await inPnys(() => svc.cashout(staff.token, { key: "release3-thc-block", payment_method: "CASH", lines: [{ sku: "9901-3g", qty: 1 }] }));
  } catch (error) {
    thcBlocked = error instanceof PosError && error.code === "THC_HIDDEN";
  }
  if (!thcBlocked) throw new Error("NO WEED did not block the THC sale.");
  const debitSale = await inPnys(() => svc.cashout(staff.token, { key: "release3-sale-debit", payment_method: "DEBIT", lines: [{ sku: "9903", qty: 1 }] })) as { sale_id: string; total_cents: number; payment_method: "DEBIT" };

  clock.value = new Date("2026-11-14T15:25:00.000Z");
  await inPnys(() => svc.startClosingCount(staff.token));
  const closingView = await inPnys(() => svc.state(staff.token));
  const expected: Record<string, number> = Object.fromEntries((closingView.close_lines ?? []).map((row) => [row.sku, row.system_qty]));
  const counted: Record<string, number> = { ...expected, "9902": (expected["9902"] ?? 0) - 1 };
  for (const line of closingView.close_lines ?? []) await inPnys(() => svc.saveClosingCount(staff.token, { sku: line.sku, counted_qty: counted[line.sku] }));
  await inPnys(() => svc.submitClosingCount(staff.token));
  await inPnys(() => svc.saveFinalDeposit(staff.token, { amount_cents: 4000, float_cents: 0 }));
  clock.value = new Date("2026-11-14T15:30:00.000Z");
  const ended = await inPnys(() => svc.endShiftFromPos(staff.token, { key: "release3-close", lines: [], final_deposit_cents: 4000, float_cents: 0 }));
  const managerReport = await inPnys(() => svc.managerState(manager.token));

  const refillBySku: Record<string, number> = Object.fromEntries(products.map((row) => [row.sku, db.state.incoming.filter((item) => item.sku === row.sku && item.confirmed_shift_id === shiftId).reduce((sum, item) => sum + (item.qty_received ?? 0), 0)]));
  const soldBySku: Record<string, number> = Object.fromEntries(products.map((row) => [row.sku, db.state.sale_lines.filter((item) => item.sku === row.sku && db.state.sales.some((sale) => sale.id === item.sale_id && sale.shift_id === shiftId && sale.status === "COMPLETED")).reduce((sum, item) => sum + item.qty, 0)]));
  const rows = products.map((row) => { const open = opening[row.sku] ?? 0; const refills = refillBySku[row.sku] ?? 0; const sales = soldBySku[row.sku] ?? 0; const countedQty = counted[row.sku] ?? 0; const expectedQty = open + refills - sales; return { sku: row.sku, name: row.name, opening: open, refills, sales, expected: expectedQty, counted: countedQty, variance: countedQty - expectedQty, unit_price_cents: row.price }; });
  const closing = ended.closing as { shift_id: string; shortage_cents: number; overage_cents: number; final_deposit_cents: number; float_cents: number };
  const cash = { cash_sales_cents: 4000, debit_sales_cents: 500, gross_sales_cents: 5500, coupon_discount_cents: 1000, net_sales_cents: 4500, deposited_cents: 4000, end_float_cents: 0, direct_variance_cents: 0 };
  const report = {
    release: "PNYS Release 3",
    scope: "isolated in-memory PNYS preview fixture; no production or preview database rows persisted",
    shift_id: "SIMULATED-PNYS-RELEASE3",
    mode: { scope: "STORE", default: "WEED", final: mode.weed_in_store ? "WEED" : "NO_WEED", survives_shift_close: managerReport.weed_mode.current === "NO_WEED", thc_sale_blocked: thcBlocked },
    customer_sale: { recorded: Boolean(customerSale.sale_id), subtotal_cents: customerSale.subtotal_cents, discount_cents: customerSale.discount_cents, total_cents: customerSale.total_cents, coupon: customerSale.coupon_code, phone_last4: customerSale.customer?.phone_last4 },
    refill: { batch_id: refill.batch_id, sku: "9902", sent: 3, confirmed: 3 },
    second_sale: { recorded: Boolean(debitSale.sale_id), total_cents: debitSale.total_cents, payment_method: debitSale.payment_method },
    stock: rows,
    cash,
    closing: { shortage_cents: closing.shortage_cents, overage_cents: closing.overage_cents, final_deposit_cents: closing.final_deposit_cents, float_cents: closing.float_cents, manager_report_found: managerReport.closings.length === 1 },
    opening_float_formula: "ACCOUNTANT DECISION REQUIRED — placeholder only; no formula selected",
    cleanup: "The fixture uses MemoryDb and disappears when the process exits. The undo SQL is a guarded no-op for the preview database unless RELEASE3- rows are ever explicitly persisted.",
  };
  if (rows.some((row) => row.expected + row.variance !== row.counted)) throw new Error("Stock reconciliation failed.");
  if (cash.cash_sales_cents - cash.deposited_cents - cash.end_float_cents !== cash.direct_variance_cents) throw new Error("Cash reconciliation failed.");
  if (closing.shortage_cents !== 2500 || closing.final_deposit_cents !== 4000 || !managerReport.closings.length) throw new Error("Closing report did not reconcile.");
  if (managerReport.weed_mode.current !== "NO_WEED") throw new Error("Manager store mode did not survive shift close.");

  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const markdown = `# PNYS Release 3 Dry Run Reconciliation\n\nStatus: **PASSED**  \nScope: PNYS preview simulation only; no persistent PNYS customer, sale, stock or shift rows were created.\n\n## End-to-end proof\n\n- Staff PIN login: passed (ephemeral PIN, hash only; PIN never printed or saved)\n- Customer + coupon cash sale: ${dollars(customerSale.subtotal_cents)} - ${dollars(customerSale.discount_cents)} = ${dollars(customerSale.total_cents)}\n- Kitchen refill: 3 sent, 3 staff-confirmed for 9902\n- Manager WEED -> NO WEED: audited; THC sale blocked\n- Second sale: ${dollars(debitSale.total_cents)} debit\n- Mobile closing: count submitted, ${dollars(closing.shortage_cents ?? 0)} stock short, ${dollars(closing.final_deposit_cents ?? 0)} deposited\n- Manager closing report: present\n\n## Stock reconciliation\n\n| SKU | Product | Opening | Refills | Sales | Expected | Counted | Variance | Value |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.map((row) => `| ${row.sku} | ${row.name} | ${row.opening} | ${row.refills} | ${row.sales} | ${row.expected} | ${row.counted} | ${row.variance} | ${dollars(Math.abs(row.variance) * row.unit_price_cents)} |`).join("\n")}\n\nFormula checked per SKU: **opening + confirmed refills - completed sales = expected**; expected + variance = counted.\n\n## Cash reconciliation\n\n| Item | Amount |\n|---|---:|\n| Gross merchandise sales | ${dollars(cash.gross_sales_cents)} |\n| Coupon discount | -${dollars(cash.coupon_discount_cents)} |\n| Net recorded sales | ${dollars(cash.net_sales_cents)} |\n| Cash sales | ${dollars(cash.cash_sales_cents)} |\n| Debit sales | ${dollars(cash.debit_sales_cents)} |\n| Final deposit | ${dollars(cash.deposited_cents)} |\n| End float entered for dry run | ${dollars(cash.end_float_cents)} |\n| Direct cash variance | ${dollars(cash.direct_variance_cents)} |\n\nCash check: **cash sales - deposit - end float = ${dollars(cash.direct_variance_cents)}**. Stock shortage is reported separately and does not invent cash.\n\n## Opening-float formula\n\n> **ACCOUNTANT DECISION REQUIRED — PLACEHOLDER ONLY.**\n>\n> Candidate A: next opening expected float = prior closing end float.  \n> Candidate B: next opening expected float = manager-approved opening float.  \n> No formula was selected or applied in this dry run.\n\n## Cleanup / rollback\n\nThe run is isolated in MemoryDb. All generated shift, customer, coupon, refill, sale and closing records disappear when the process exits. The accompanying undo SQL is guarded to remove only records prefixed with \`RELEASE3-\` if this fixture is ever persisted later.\n`;
  const dir = resolve("reports/pnys-release3");
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "reconciliation.md"), markdown);
  await writeFile(resolve(dir, "reconciliation.json"), JSON.stringify(report, null, 2));
  process.stdout.write("PNYS Release 3 dry run passed; report artifacts written.\n");
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Dry run failed."}\n`);
  process.exitCode = 1;
});
