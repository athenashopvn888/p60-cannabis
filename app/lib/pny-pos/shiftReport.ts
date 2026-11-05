import type { SheetRow } from "./types.ts";

type Shift = {
  id?: string;
  sccx_shift_id?: string;
  staff_uid?: string;
  store_code?: string;
  status?: string;
  end_reason?: string | null;
  pin_failed_attempts?: number;
  started_at?: string;
  ended_at?: string | null;
};
type DraftCount = { sku?: string; counted_qty?: number; edited_at?: string; accepted_as_is?: boolean; expected_qty?: number };
type Draft = {
  shift_id?: string;
  closing_started_at?: string | null;
  closing_submitted_at?: string | null;
  counts?: DraftCount[];
  final_deposit_cents?: number | null;
};
type ClosingLine = { sku?: string; name?: string; left?: number; expected_qty?: number; variance_qty?: number };
type Closing = {
  shift_id?: string;
  summary_text?: string;
  close_label?: string | null;
  sales_total_cents?: number;
  cash_sales_cents?: number;
  debit_sales_cents?: number;
  sale_count?: number;
  void_count?: number;
  cash_on_hand_cents?: number;
  deposited_cents?: number;
  final_deposit_cents?: number;
  shortage_cents?: number;
  overage_cents?: number;
  balance_cents?: number;
  no_count?: boolean;
  closing_lines?: ClosingLine[];
};
type Staff = { staff_uid?: string; pos_id?: string; display_name?: string };
type Balance = { sku?: string; qty?: number; store_code?: string };
type Deposit = { shift_id?: string; amount_cents?: number; note?: string | null; deposit_code?: string | null; created_at?: string };
export type ParsedState = {
  shifts?: Shift[];
  closing_drafts?: Draft[];
  closings?: Closing[];
  staff?: Staff[];
  balances?: Balance[];
  deposits?: Deposit[];
  sessions?: { shift_id?: string; revoked_at?: string | null }[];
};

export function activeStateChunks(rows: SheetRow[]) {
  return rows
    .filter((row) => row.record_type === "STATE" && row.row_id?.startsWith("STATE-") && row.doc)
    .sort((a, b) => (a.row_id ?? "").localeCompare(b.row_id ?? ""));
}

export function tryState(raw: string): ParsedState | null {
  try {
    const value = JSON.parse(raw) as ParsedState;
    if (!value || typeof value !== "object" || !Array.isArray(value.shifts)) return null;
    return value;
  } catch {
    return null;
  }
}

function openShifts(parsed: ParsedState, store: string) {
  return (parsed.shifts ?? []).filter((shift) => (shift.store_code ?? "PNY01") === store && shift.status !== "ENDED");
}

function latestShift(parsed: ParsedState, store: string) {
  return [...(parsed.shifts ?? []).filter((shift) => (shift.store_code ?? "PNY01") === store)]
    .sort((a, b) => (b.ended_at || b.started_at || "").localeCompare(a.ended_at || a.started_at || ""))[0];
}

export function reportStore(parsed: ParsedState, store: string) {
  const open = openShifts(parsed, store);
  const focus = open[0] ?? latestShift(parsed, store);
  const draft = focus ? (parsed.closing_drafts ?? []).find((row) => row.shift_id === focus.id) : undefined;
  const closing = focus ? (parsed.closings ?? []).find((row) => row.shift_id === focus.id) : undefined;
  const staff = (parsed.staff ?? []).find((row) => row.staff_uid === focus?.staff_uid);
  const counted: { sku: string; name: string; counted_qty: number; expected_qty: number | null; variance_qty: number | null }[] = [];
  const accepted: { sku: string; name: string; qty: number }[] = [];
  for (const line of closing?.closing_lines ?? []) {
    const saved = draft?.counts?.find((row) => row.sku === line.sku);
    const wasCounted = Boolean(saved && !saved.accepted_as_is && saved.edited_at);
    if (wasCounted) {
      counted.push({
        sku: line.sku ?? "",
        name: line.name ?? "",
        counted_qty: saved?.counted_qty ?? line.left ?? 0,
        expected_qty: line.expected_qty ?? null,
        variance_qty: line.variance_qty ?? null,
      });
    } else {
      accepted.push({ sku: line.sku ?? "", name: line.name ?? "", qty: line.left ?? 0 });
    }
  }
  const closed = Boolean(focus && focus.status === "ENDED" && closing);
  let missing: string | null = null;
  if (!closed) {
    if (!focus) missing = `No ${store} shift was found.`;
    else if (focus.status === "ENDED") missing = "The shift is marked ended but has no closing record.";
    else if (!draft?.closing_started_at) missing = "The closing count was not started.";
    else if (!draft.closing_submitted_at) missing = "The closing count has not been submitted.";
    else if (draft.final_deposit_cents == null) missing = "The final deposit has not been saved.";
    else missing = "The final deposit is saved, but the shift was not locked. The closing screen did not finish.";
  }
  const stocked = (parsed.balances ?? []).filter((row) => (store === "PNY02" ? row.store_code === "PNY02" : !row.store_code || row.store_code === "PNY01") && (row.qty ?? 0) > 0).length;
  return {
    closed,
    missing,
    open_shifts: open.map((shift) => shift.status ?? ""),
    status: focus?.status ?? null,
    end_reason: focus?.end_reason ?? null,
    started_at: focus?.started_at ?? null,
    ended_at: focus?.ended_at ?? null,
    staff_pos_id: staff?.pos_id ?? "",
    staff_name: staff?.display_name ?? "",
    pin_failed_attempts: focus?.pin_failed_attempts ?? null,
    closing_started: Boolean(draft?.closing_started_at),
    closing_submitted: Boolean(draft?.closing_submitted_at),
    draft_counted_lines: draft?.counts?.length ?? 0,
    draft_final_deposit_cents: draft?.final_deposit_cents ?? null,
    final_deposit_cents: closing?.final_deposit_cents ?? null,
    close_label: closing?.close_label ?? null,
    summary_text: closing?.summary_text ?? null,
    sales_total_cents: closing?.sales_total_cents ?? null,
    deposited_cents: closing?.deposited_cents ?? null,
    cash_on_hand_cents: closing?.cash_on_hand_cents ?? null,
    counted,
    accepted,
    stocked_skus: stocked,
    deposits: (parsed.deposits ?? [])
      .filter((row) => row.shift_id === focus?.id)
      .map((row) => ({
        amount_cents: row.amount_cents ?? 0,
        note: row.note ?? "",
        deposit_code: row.deposit_code ?? null,
        created_at: row.created_at ?? null,
      })),
  };
}
