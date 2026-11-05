import { safeEqual } from "@/app/lib/pny-pos/crypto";
import { json } from "@/app/lib/pny-pos/http";
import { activeStateChunks, tryState } from "@/app/lib/pny-pos/shiftReport";
import { sheetFromEnv } from "@/app/lib/pny-pos/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOCUS = ["170-3g", "172-3g", "187-3g", "189", "202-5g", "332-3g", "337-3g", "388", "1002", "1005", "1006", "1015", "1016"];
const KIN = ["170-28g", "172-28g", "187-28g", "202-14g", "332-5g", "337-5g"];

type Sale = { id?: string; shift_id?: string; status?: string; payment_method?: string; total_cents?: number; created_at?: string; ref_no?: string };
type Line = { sale_id?: string; sku?: string; qty?: number; unit_price_cents?: number };
type Deposit = { shift_id?: string; amount_cents?: number; note?: string | null; deposit_code?: string | null; created_at?: string };
type Incoming = { sku?: string; confirmed_shift_id?: string | null; status?: string; qty_sent?: number; qty_received?: number | null; confirmed_at?: string | null; created_at?: string };
type Count = { id?: string; shift_id?: string; kind?: string };
type CountLine = { count_id?: string; sku?: string; system_qty?: number; counted_qty?: number };
type Ledger = { sku?: string; qty_delta?: number; movement_type?: string; shift_id?: string | null; store_code?: string; reason?: string | null; created_at?: string };
type DraftCount = { sku?: string; counted_qty?: number; expected_qty?: number; edited_at?: string; accepted_as_is?: boolean };
type OpeningCount = { sku?: string; counted_qty?: number; expected_qty?: number; accepted_as_is?: boolean; edited_at?: string };
type Draft = { shift_id?: string; verify_submitted_at?: string | null; closing_submitted_at?: string | null; counts?: DraftCount[]; opening_counts?: OpeningCount[] };
type ClosingLine = { sku?: string; name?: string; left?: number; expected_qty?: number; variance_qty?: number; price_cents?: number; opening_qty?: number; received_qty?: number; sold_qty?: number; shortage_cents?: number; overage_cents?: number };
type Closing = { shift_id?: string; closing_lines?: ClosingLine[]; shortage_cents?: number; overage_cents?: number; balance_cents?: number; cash_on_hand_cents?: number; deposited_cents?: number; cash_sales_cents?: number; debit_sales_cents?: number; final_deposit_cents?: number; sales_total_cents?: number };
type Shift = { id?: string; sccx_shift_id?: string; store_code?: string; status?: string; started_at?: string; ended_at?: string | null };
type Product = { sku?: string; name?: string };
type State = {
  shifts?: Shift[];
  sales?: Sale[];
  sale_lines?: Line[];
  deposits?: Deposit[];
  incoming?: Incoming[];
  counts?: Count[];
  count_lines?: CountLine[];
  ledger?: Ledger[];
  closing_drafts?: Draft[];
  closings?: Closing[];
  balances?: { sku?: string; qty?: number; store_code?: string }[];
  products?: Product[];
};

function authorized(request: Request) {
  const secret = process.env.SHIFT_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return Boolean(secret && token && safeEqual(token, secret));
}

function pny01(row: { store_code?: string }) {
  return !row.store_code || row.store_code === "PNY01";
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ ok: false, error: "unauthorized" }, 401);
  const sheet = sheetFromEnv();
  if (!sheet.configured) return json({ ok: false, error: "sheet is not configured" }, 500);
  const chunks = activeStateChunks(await sheet.readRows("POS_Staff"));
  const parsed = tryState(chunks.map((row) => row.doc).join("")) as State | null;
  if (!parsed) return json({ ok: false, error: "state does not parse" }, 409);
  const shift = [...(parsed.shifts ?? [])].filter((row) => (row.store_code ?? "PNY01") === "PNY01" && row.status === "ENDED").sort((a, b) => (b.ended_at || "").localeCompare(a.ended_at || ""))[0];
  if (!shift?.id) return json({ ok: false, error: "no ended PNY01 shift" }, 404);
  const shiftId = shift.id;
  const sales = (parsed.sales ?? []).filter((row) => row.shift_id === shiftId);
  const saleIds = new Set(sales.map((row) => row.id));
  const lines = (parsed.sale_lines ?? []).filter((row) => saleIds.has(row.sale_id));
  const deposits = (parsed.deposits ?? []).filter((row) => row.shift_id === shiftId);
  const completed = sales.filter((row) => row.status === "COMPLETED");
  const cash = completed.filter((row) => row.payment_method !== "DEBIT").reduce((sum, row) => sum + (row.total_cents ?? 0), 0);
  const debit = completed.filter((row) => row.payment_method === "DEBIT").reduce((sum, row) => sum + (row.total_cents ?? 0), 0);
  const deposited = deposits.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  const closing = (parsed.closings ?? []).find((row) => row.shift_id === shiftId);
  const shortage = (closing?.closing_lines ?? []).reduce((sum, line) => sum + (line.shortage_cents ?? 0), 0);
  const overage = (closing?.closing_lines ?? []).reduce((sum, line) => sum + (line.overage_cents ?? 0), 0);
  const draft = (parsed.closing_drafts ?? []).find((row) => row.shift_id === shiftId);
  const opening = (parsed.counts ?? []).find((row) => row.shift_id === shiftId && row.kind === "OPENING");
  const openingLines = opening ? (parsed.count_lines ?? []).filter((row) => row.count_id === opening.id) : [];
  const closingCount = (parsed.counts ?? []).find((row) => row.shift_id === shiftId && row.kind === "CLOSING");

  const trace = (sku: string) => {
    const openingLine = openingLines.find((row) => row.sku === sku);
    const openingDraft = draft?.opening_counts?.find((row) => row.sku === sku);
    const refills = (parsed.incoming ?? []).filter((row) => row.confirmed_shift_id === shiftId && row.sku === sku);
    const sold = lines.filter((row) => row.sku === sku);
    const soldQty = sold.reduce((sum, row) => sum + (row.qty ?? 0), 0);
    const received = refills.filter((row) => row.status === "CONFIRMED" || row.status === "PARTIAL").reduce((sum, row) => sum + (row.qty_received ?? 0), 0);
    const saved = draft?.counts?.find((row) => row.sku === sku);
    const closeLine = closing?.closing_lines?.find((row) => row.sku === sku);
    const ledger = (parsed.ledger ?? []).filter((row) => row.sku === sku && (row.shift_id === shiftId || pny01(row)));
    const openingQty = openingLine?.counted_qty ?? null;
    return {
      sku,
      opening_counted: openingLine?.counted_qty ?? null,
      opening_system: openingLine?.system_qty ?? null,
      opening_draft: openingDraft ? { counted: openingDraft.counted_qty, expected: openingDraft.expected_qty, accepted_as_is: Boolean(openingDraft.accepted_as_is) } : null,
      received,
      refills: refills.map((row) => ({ status: row.status, sent: row.qty_sent, received: row.qty_received, at: row.confirmed_at })),
      sold: soldQty,
      sale_events: sold.map((row) => {
        const sale = sales.find((item) => item.id === row.sale_id);
        return { qty: row.qty, price: row.unit_price_cents, at: sale?.created_at, status: sale?.status, ref: sale?.ref_no };
      }),
      recomputed_expected: openingQty == null ? null : openingQty + received - soldQty,
      draft: saved ? { counted: saved.counted_qty, expected: saved.expected_qty, edited_at: saved.edited_at, accepted_as_is: Boolean(saved.accepted_as_is) } : null,
      close: closeLine ? { counted: closeLine.left, expected: closeLine.expected_qty, variance: closeLine.variance_qty, opening: closeLine.opening_qty, received: closeLine.received_qty, sold: closeLine.sold_qty, price: closeLine.price_cents, shortage: closeLine.shortage_cents, overage: closeLine.overage_cents } : null,
      ledger: ledger.filter((row) => row.shift_id === shiftId).map((row) => ({ type: row.movement_type, delta: row.qty_delta, at: row.created_at, reason: row.reason })),
      on_hand: (parsed.balances ?? []).find((row) => row.sku === sku && pny01(row))?.qty ?? null,
    };
  };

  let sheetSales: { sale_id: string; total: string; status: string; created_at: string }[] = [];
  try {
    const rows = await sheet.readRows("POS_Sales");
    sheetSales = rows.filter((row) => row.shift_id === shift.sccx_shift_id || row.shift_id === shiftId || (row.doc ?? "").includes(shiftId)).map((row) => ({
      sale_id: row.sale_id || row.row_id || "",
      total: row.total_cents || "",
      status: row.status || "",
      created_at: row.created_at || "",
    }));
  } catch {
    sheetSales = [];
  }

  let backupHits: { row_id: string; length: number; sale_ids_not_in_state: string[] }[] = [];
  try {
    const backup = await sheet.readRows("POS_State_Backup");
    const known = new Set((parsed.sales ?? []).map((row) => row.id).filter(Boolean) as string[]);
    backupHits = backup.map((row) => {
      const ids = [...(row.doc ?? "").matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map((match) => match[0]);
      const missing = [...new Set(ids)].filter((id) => !known.has(id) && (row.doc ?? "").includes(`"id":"${id}"`) && (row.doc ?? "").includes(`"shift_id":"${shiftId}"`));
      const near = missing.filter((id) => {
        const at = (row.doc ?? "").indexOf(id);
        return (row.doc ?? "").slice(Math.max(0, at - 80), at + 80).includes("total_cents");
      });
      return { row_id: row.row_id ?? "", length: (row.doc ?? "").length, sale_ids_not_in_state: near };
    }).filter((row) => row.sale_ids_not_in_state.length > 0 || row.row_id.startsWith("STATE-07"));
  } catch {
    backupHits = [];
  }

  const stateSaleIds = new Set(sales.map((row) => row.id));
  const sheetIds = new Set(sheetSales.map((row) => row.sale_id));
  const openingOff = openingLines.filter((row) => row.counted_qty !== row.system_qty).map((row) => ({ sku: row.sku, counted: row.counted_qty, system: row.system_qty }));

  return json({
    ok: true,
    shift: { id: shiftId, sccx: (shift as { sccx_shift_id?: string }).sccx_shift_id ?? null, started_at: shift.started_at, ended_at: shift.ended_at },
    till: {
      cash_sales_cents: cash,
      debit_sales_cents: debit,
      sales_total_cents: cash + debit,
      deposited_cents: deposited,
      cash_on_hand_cents: cash - deposited,
      shortage_cents: shortage,
      overage_cents: overage,
      balance_cents: cash + shortage - overage - deposited,
      stored: {
        cash: closing?.cash_sales_cents,
        debit: closing?.debit_sales_cents,
        sales: closing?.sales_total_cents,
        deposited: closing?.deposited_cents,
        coh: closing?.cash_on_hand_cents,
        shortage: closing?.shortage_cents,
        overage: closing?.overage_cents,
        balance: closing?.balance_cents,
        final: closing?.final_deposit_cents,
      },
      deposits,
      sale_count: completed.length,
      void_count: sales.filter((row) => row.status === "VOIDED").length,
    },
    sales: completed.map((row) => ({
      id: row.id,
      at: row.created_at,
      total: row.total_cents,
      method: row.payment_method,
      ref: row.ref_no,
      lines: linesOf(lines, row.id),
    })),
    duplicates: sales.map((row) => row.id).filter((id, index, all) => all.indexOf(id) !== index),
    sheet_sales_not_in_state: [...sheetIds].filter((id) => id && !stateSaleIds.has(id)),
    state_sales_not_on_sheet: [...stateSaleIds].filter((id) => id && !sheetIds.has(id)),
    backup: backupHits,
    opening: {
      verified: Boolean(draft?.verify_submitted_at),
      submitted_at: draft?.verify_submitted_at ?? null,
      off: (draft?.opening_counts ?? []).flatMap((row) => {
        if (row.accepted_as_is || row.expected_qty == null || row.counted_qty === row.expected_qty) return [];
        const name = (parsed.products ?? []).find((item) => item.sku === row.sku)?.name ?? row.sku;
        return [{ sku: row.sku, name, counted: row.counted_qty, expected: row.expected_qty, off: (row.counted_qty ?? 0) - row.expected_qty }];
      }),
      system_off: openingOff,
      line_count: openingLines.length,
    },
    refills: (() => {
      const grouped = new Map<string, { sent: number; received: number }>();
      for (const row of parsed.incoming ?? []) {
        if (row.confirmed_shift_id !== shiftId) continue;
        if (row.status !== "CONFIRMED" && row.status !== "PARTIAL" && row.status !== "REJECTED") continue;
        const current = grouped.get(row.sku ?? "") ?? { sent: 0, received: 0 };
        current.sent += row.qty_sent ?? 0;
        current.received += row.qty_received ?? 0;
        if (row.sku) grouped.set(row.sku, current);
      }
      return [...grouped.entries()].flatMap(([sku, totals]) => {
        if (totals.received === totals.sent) return [];
        const name = (parsed.products ?? []).find((item) => item.sku === sku)?.name ?? sku;
        return [{ sku, name, sent: totals.sent, received: totals.received, diff: totals.received - totals.sent }];
      });
    })(),
    focus: [...FOCUS, ...KIN].map(trace),
    closing_count_id: closingCount?.id ?? null,
  });
}

function linesOf(lines: Line[], saleId?: string) {
  return lines.filter((row) => row.sale_id === saleId).map((row) => ({ sku: row.sku, qty: row.qty, price: row.unit_price_cents }));
}
