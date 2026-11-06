import { sheetFromEnv } from "./sheets.ts";
import type { State } from "./types.ts";

/** Read the shared POS state. Does not write the sheet. */
export async function readSheetState(): Promise<State> {
  const sheet = sheetFromEnv();
  if (!sheet.configured) throw new Error("Sheet credentials are not configured.");
  const rows = await sheet.readRows("POS_Staff");
  const parts = rows
    .filter((row) => row.record_type === "STATE" && String(row.row_id ?? "").startsWith("STATE-") && row.doc)
    .sort((a, b) => String(a.row_id).localeCompare(String(b.row_id)));
  if (parts.length === 0) throw new Error("POS_Staff has no state.");
  return JSON.parse(parts.map((row) => row.doc).join("")) as State;
}

export function pny2CloseReport(state: State) {
  const shifts = state.shifts.filter((row) => row.store_code === "PNY02");
  const latest = [...shifts].filter((row) => row.status === "ENDED").sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0] ?? null;
  const closing = latest ? state.closings.find((row) => row.shift_id === latest.id) ?? null : null;
  const draft = latest ? state.closing_drafts?.find((row) => row.shift_id === latest.id) ?? null : null;
  const deposits = latest ? state.deposits.filter((row) => row.shift_id === latest.id) : [];
  const staff = state.staff.map((row) => ({
    staff_uid: row.staff_uid,
    pos_id: row.pos_id,
    display_name: row.display_name,
    active: row.active,
  }));
  const open = (draft?.opening_counts ?? []).flatMap((row) => {
    if (row.accepted_as_is || row.expected_qty == null) return [];
    const units = row.counted_qty - row.expected_qty;
    if (units === 0) return [];
    return [{ sku: row.sku, units, counted: row.counted_qty, expected: row.expected_qty }];
  });
  const refillMap = new Map<string, { sent: number; received: number }>();
  for (const row of state.incoming) {
    if (!latest || row.confirmed_shift_id !== latest.id) continue;
    const current = refillMap.get(row.sku) ?? { sent: 0, received: 0 };
    current.sent += row.qty_sent;
    current.received += row.qty_received ?? 0;
    refillMap.set(row.sku, current);
  }
  const refills = [...refillMap.entries()].flatMap(([sku, totals]) => {
    const units = totals.received - totals.sent;
    if (units === 0) return [];
    return [{ sku, units, sent: totals.sent, received: totals.received }];
  });
  const closingLines = (closing?.closing_lines ?? []).map((line) => ({
    sku: line.sku,
    name: line.name,
    qty: line.left,
    price_cents: line.price_cents ?? 0,
    variance_qty: line.variance_qty ?? line.left - (line.expected_qty ?? line.system_qty),
    shortage_cents: line.shortage_cents ?? 0,
    overage_cents: line.overage_cents ?? 0,
    sold_qty: line.sold_qty ?? 0,
  }));
  const units = closingLines.reduce((sum, line) => sum + line.qty, 0);
  const cash = closing?.cash_sales_cents ?? closing?.sales_total_cents ?? 0;
  const deposited = closing?.deposited_cents ?? deposits.reduce((sum, row) => sum + row.amount_cents, 0);
  return {
    staff,
    shift: latest && {
      id: latest.id,
      sccx_shift_id: latest.sccx_shift_id,
      staff_uid: latest.staff_uid,
      status: latest.status,
      started_at: latest.started_at,
      ended_at: latest.ended_at,
    },
    open_shifts: shifts.filter((row) => row.status === "ACTIVE" || row.status === "CLOSING" || row.status === "LOCKED").map((row) => row.sccx_shift_id),
    cash_sales_cents: cash,
    debit_sales_cents: closing?.debit_sales_cents ?? 0,
    sales_total_cents: closing?.sales_total_cents ?? 0,
    deposited_cents: deposited,
    cash_on_hand_cents: closing?.cash_on_hand_cents ?? 0,
    float_cents: closing?.float_cents ?? 0,
    float_found_cents: draft?.float_found_cents ?? null,
    float_expected_cents: draft?.float_expected_cents ?? null,
    coh_matches_sales_minus_deposits: cash - deposited === (closing?.cash_on_hand_cents ?? 0),
    deposits: deposits.map((row) => ({ code: row.deposit_code ?? "", amount_cents: row.amount_cents, at: row.created_at })),
    opening: open,
    refills,
    closing_lines: closingLines,
    closing_sku_count: closingLines.length,
    closing_units: units,
  };
}
