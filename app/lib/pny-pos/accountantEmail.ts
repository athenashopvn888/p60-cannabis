import { STORE_TZ } from "./constants.ts";
import { skuSortKey } from "./flowerSku.ts";
import { formatMoney } from "./money.ts";
import { stockClosingReportFileName } from "./stockClosingReport.ts";
import type { ClosingRow, IncomingRow, ShiftRow, State } from "./types.ts";

export const ACCOUNTANT_EMAIL = "doli.doli.080496@gmail.com";
export const ACCOUNTANT_CC = "athenashopvn888@gmail.com";

function storeStamp(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function nameOf(state: State, sku: string) {
  return state.products.find((row) => row.sku === sku)?.name ?? "Unknown item";
}

export function ensureRefillId(state: State, batchId: string, storeCode: string) {
  const existing = state.incoming.find((row) => row.batch_id === batchId && row.refill_id)?.refill_id;
  if (existing) return existing;
  const seqs = state.refill_seq_by_store ?? (state.refill_seq_by_store = {});
  const next = (seqs[storeCode] ?? 0) + 1;
  seqs[storeCode] = next;
  return `${storeCode}-R${String(next).padStart(4, "0")}`;
}

export function refillEmailPayload(state: State, rows: IncomingRow[], stage: "SENT" | "RECEIVED", at: string, staffName = "") {
  const first = rows[0];
  if (!first) throw new Error("A refill email requires at least one line.");
  const refillId = first.refill_id ?? first.batch_id;
  const sentBy = first.created_by || "Kitchen";
  const lineText = [...rows]
    .sort((a, b) => skuSortKey(a.sku) - skuSortKey(b.sku) || a.sku.localeCompare(b.sku))
    .map((row) => {
      const received = row.qty_received == null ? "" : ` | received ${row.qty_received}`;
      const variance = row.variance_reason ? ` | reason: ${row.variance_reason}` : "";
      return `${row.sku} | ${nameOf(state, row.sku)} | sent ${row.qty_sent}${received}${variance}`;
    });
  const totalSent = rows.reduce((sum, row) => sum + row.qty_sent, 0);
  const totalReceived = rows.reduce((sum, row) => sum + (row.qty_received ?? 0), 0);
  const subject = `${first.store_code} REFILL ${refillId} ${stage}`;
  const body = [
    subject,
    `Date: ${storeStamp(at)} Toronto`,
    `Sent by: ${sentBy}`,
    ...(stage === "RECEIVED" ? [`Received by: ${staffName || "Staff"}`] : []),
    "",
    ...lineText,
    "",
    `Lines: ${rows.length}`,
    `Units sent: ${totalSent}`,
    ...(stage === "RECEIVED" ? [`Units received: ${totalReceived}`] : []),
  ].join("\n");
  return {
    row_id: `EMAIL-${stage}-${refillId}`,
    to: ACCOUNTANT_EMAIL,
    cc: ACCOUNTANT_CC,
    subject,
    body,
    status: "PENDING",
    created_at: at,
    sent_at: "",
    last_error: "",
  };
}

export function closingEmailPayload(state: State, shift: ShiftRow, closing: ClosingRow, at: string) {
  const staff = state.staff.find((row) => row.staff_uid === shift.staff_uid);
  const draft = state.closing_drafts.find((row) => row.shift_id === shift.id);
  const previousShift = state.shifts
    .filter((row) => row.store_code === shift.store_code && row.id !== shift.id && row.status === "ENDED" && row.ended_at)
    .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
  const previousFloatCents = previousShift
    ? state.closings.find((row) => row.shift_id === previousShift.id)?.float_cents ?? null
    : null;
  const onHand = state.balances
    .filter((row) => (row.store_code == null || row.store_code === shift.store_code) && row.qty > 0)
    .sort((a, b) => skuSortKey(a.sku) - skuSortKey(b.sku) || a.sku.localeCompare(b.sku));
  const saleIds = new Set(
    state.sales
      .filter((row) => row.shift_id === shift.id && row.status === "COMPLETED")
      .map((row) => row.id),
  );
  const soldBySku = new Map<string, number>();
  for (const row of state.sale_lines) {
    if (!saleIds.has(row.sale_id)) continue;
    soldBySku.set(row.sku, (soldBySku.get(row.sku) ?? 0) + row.qty);
  }
  const sold = [...soldBySku]
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => skuSortKey(a) - skuSortKey(b) || a.localeCompare(b));
  const startingFloatCents = draft?.float_found_cents ?? draft?.float_expected_cents ?? previousFloatCents;
  const startingFloatConfirmed = draft?.float_found_cents != null;
  const staffName = staff?.display_name ?? staff?.pos_id ?? "Staff";
  const stockDifferences = closing.closing_lines
    .map((line) => {
      const qtyDifference = line.variance_qty ?? line.left - (line.expected_qty ?? line.system_qty);
      const valueDifference = (line.overage_cents ?? 0) - (line.shortage_cents ?? 0)
        || qtyDifference * (line.price_cents ?? 0);
      return { line, qtyDifference, valueDifference };
    })
    .filter((row) => row.qtyDifference !== 0)
    .sort((a, b) => skuSortKey(a.line.sku) - skuSortKey(b.line.sku) || a.line.sku.localeCompare(b.line.sku));
  const calculatedShortage = stockDifferences.reduce((sum, row) => sum + Math.max(0, -row.valueDifference), 0);
  const calculatedOverage = stockDifferences.reduce((sum, row) => sum + Math.max(0, row.valueDifference), 0);
  if (calculatedShortage !== (closing.shortage_cents ?? 0) || calculatedOverage !== (closing.overage_cents ?? 0)) {
    throw new Error(`CLOSING_EMAIL_VARIANCE_MISMATCH:${shift.id}`);
  }
  const shortQty = stockDifferences.reduce((sum, row) => sum + Math.max(0, -row.qtyDifference), 0);
  const extraQty = stockDifferences.reduce((sum, row) => sum + Math.max(0, row.qtyDifference), 0);
  const netStock = calculatedOverage - calculatedShortage;
  const finalTill = closing.balance_cents ?? 0;
  const subject = `${shift.store_code} CLOSING TILL - ${staff?.display_name ?? staff?.pos_id ?? "Staff"}`;
  const body = [
    subject,
    `Shift ref: ${closing.shift_ref ?? "UNAVAILABLE"}`,
    `Shift: ${storeStamp(shift.started_at)} - ${storeStamp(shift.ended_at ?? at)} Toronto`,
    `Sales: ${formatMoney(closing.sales_total_cents)}`,
    `Orders: ${closing.sale_count}`,
    `Cash sales: ${formatMoney(closing.cash_sales_cents ?? closing.sales_total_cents)}`,
    `Debit sales: ${formatMoney(closing.debit_sales_cents ?? 0)}`,
    `Deposited: ${formatMoney(closing.deposited_cents)}`,
    `Final deposit: ${formatMoney(closing.final_deposit_cents ?? 0)}`,
    `Starting float: ${startingFloatCents == null ? "UNAVAILABLE" : formatMoney(startingFloatCents)} (${startingFloatConfirmed ? "CONFIRMED" : "NOT CONFIRMED"})`,
    `Closing float: ${formatMoney(closing.float_cents ?? 0)}`,
    `TOTAL SHORT stock: -${shortQty} units | -${formatMoney(calculatedShortage)}`,
    `TOTAL EXTRA stock: +${extraQty} units | +${formatMoney(calculatedOverage)}`,
    `NET STOCK: ${netStock >= 0 ? `OVER +${formatMoney(netStock)}` : `SHORT -${formatMoney(Math.abs(netStock))}`}`,
    `Final till balance: ${finalTill < 0 ? `OVER +${formatMoney(-finalTill)}` : finalTill > 0 ? `SHORT -${formatMoney(finalTill)}` : "EVEN $0.00"}`,
    "",
    `STOCK COUNT DIFFERENCES (${stockDifferences.length} SKUs)`,
    ...(stockDifferences.length
      ? stockDifferences.map(({ line, qtyDifference, valueDifference }) => `${line.sku} | ${line.name || nameOf(state, line.sku)} | expected ${line.expected_qty ?? line.system_qty} | counted ${line.left} | qty ${qtyDifference > 0 ? "+" : ""}${qtyDifference} | value ${valueDifference > 0 ? "+" : "-"}${formatMoney(Math.abs(valueDifference))} | ${qtyDifference < 0 ? "SHORT" : "OVER"}`)
      : ["All stock matched."]),
    "",
    `SOLD THIS SHIFT (${sold.length} SKUs)`,
    ...sold.map(([sku, qty]) => `${sku} | ${nameOf(state, sku)} | ${qty}`),
    "",
    `Total sold units: ${sold.reduce((sum, [, qty]) => sum + qty, 0)}`,
    "",
    `ON HAND STOCK (${onHand.length} SKUs)`,
    ...onHand.map((row) => `${row.sku} | ${nameOf(state, row.sku)} | ${row.qty}`),
    "",
    `Total on-hand units: ${onHand.reduce((sum, row) => sum + row.qty, 0)}`,
    "",
    `System shift ID: ${shift.sccx_shift_id || shift.id}`,
  ].join("\n");
  return {
    row_id: `EMAIL-CLOSE-${shift.id}`,
    to: ACCOUNTANT_EMAIL,
    cc: ACCOUNTANT_CC,
    subject,
    body,
    attachment_name: stockClosingReportFileName({
      storeCode: shift.store_code,
      staffName,
      closeDate: shift.ended_at ?? at,
      shiftRef: closing.shift_ref ?? "UNAVAILABLE",
      systemShiftId: shift.sccx_shift_id || shift.id,
      startingFloatCents,
      startingFloatConfirmed,
      closing,
    }),
    attachment_report_json: JSON.stringify({
      storeCode: shift.store_code,
      staffName,
      closeDate: shift.ended_at ?? at,
      shiftRef: closing.shift_ref ?? "UNAVAILABLE",
      systemShiftId: shift.sccx_shift_id || shift.id,
      startingFloatCents,
      startingFloatConfirmed,
      closing: {
        sales_total_cents: closing.sales_total_cents,
        debit_sales_cents: closing.debit_sales_cents ?? 0,
        deposited_cents: closing.deposited_cents,
        float_cents: closing.float_cents ?? 0,
        shortage_cents: closing.shortage_cents ?? 0,
        overage_cents: closing.overage_cents ?? 0,
        balance_cents: closing.balance_cents ?? 0,
        closing_lines: closing.closing_lines,
      },
    }),
    status: "PENDING",
    created_at: at,
    sent_at: "",
    last_error: "",
  };
}
