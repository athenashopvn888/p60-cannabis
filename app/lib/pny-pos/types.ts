export type ShiftStatus = "ACTIVE" | "LOCKED" | "CLOSING" | "ENDED";
export type MovementType = "OPENING_BALANCE" | "INCOMING_CONFIRM" | "SALE" | "VOID" | "ADJUSTMENT" | "COUNT_VARIANCE";
export type IncomingStatus = "PENDING_CONFIRM" | "CONFIRMED" | "PARTIAL" | "REJECTED" | "CANCELLED_BY_KITCHEN";
export type TicketStatus = "PENDING" | "OPEN" | "CASHED_OUT" | "EXPIRED" | "CANCELLED";
export type EndReason = "POS_END" | "SCCX_OFF" | "SCCX_AUTOCLOSE" | "EXPIRED" | "UNLINKED" | "ADMIN" | "REPLACED";

export type StoreRow = {
  code: string;
  name: string;
  active: boolean;
  timezone: string;
  prices_tax_included: boolean;
  ticket_letter_seq: number;
  created_at: string;
};

export type ProductRow = {
  sku: string;
  sku_sort: number;
  name: string;
  category: string;
  default_price_cents: number;
  image_url: string | null;
  setb_active: boolean;
  synced_at: string | null;
  created_at: string;
};

export type StoreProductRow = {
  store_code: string;
  sku: string;
  enabled: boolean;
  price_override_cents: number | null;
  created_at: string;
  updated_at: string;
};

export type LedgerRow = {
  id: string;
  sku: string;
  qty_delta: number;
  movement_type: MovementType;
  ref_type: string | null;
  ref_id: string | null;
  actor: string | null;
  reason: string | null;
  shift_id: string | null;
  created_at: string;
  store_code?: string;
};

export type BalanceRow = {
  sku: string;
  qty: number;
  updated_at: string;
  created_at: string;
  store_code?: string;
};

export type StaffRow = {
  staff_uid: string;
  sccx_id: string;
  pos_id: string;
  display_name: string;
  active: boolean;
  updated_at: string;
  created_at: string;
};

export type ShiftRow = {
  id: string;
  sccx_shift_id: string;
  staff_uid: string;
  store_code: string;
  ticket_letter: string;
  ticket_seq: number;
  pin_hash: string | null;
  pin_expires_at: string | null;
  pin_failed_attempts: number;
  status: ShiftStatus;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  opening_confirmed_at: string | null;
  refill_confirmed_at: string | null;
  /** Staff verify window start. Missing until the first staff PIN login of this release. */
  verify_opened_at?: string | null;
  verify_release?: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  shift_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  master?: boolean;
};

export type IncomingRow = {
  kitchen_row_id: string;
  batch_id: string;
  store_code: string;
  sku: string;
  qty_sent: number;
  kind: "ALLOCATION" | "REFILL";
  kitchen_created_at: string | null;
  imported_at: string;
  status: IncomingStatus;
  qty_received: number | null;
  variance_reason: string | null;
  confirmed_shift_id: string | null;
  confirmed_at: string | null;
  linked_ledger_id: string | null;
  created_at: string;
};

export type CountRow = {
  id: string;
  shift_id: string;
  kind: "OPENING" | "CLOSING";
  confirmed_at: string;
  created_at: string;
};

export type CountLineRow = {
  id: string;
  count_id: string;
  sku: string;
  system_qty: number;
  counted_qty: number;
  variance_reason: string | null;
};

export type TicketRow = {
  id: string;
  shift_id: string;
  code: string;
  status: TicketStatus;
  source: string;
  expires_at: string;
  created_at: string;
};

export type TicketLineRow = {
  id: string;
  ticket_id: string;
  sku: string;
  qty: number;
  unit_price_cents_snapshot: number;
};

export type SaleRow = {
  id: string;
  ref_no: string;
  shift_id: string;
  staff_uid: string;
  ticket_id: string | null;
  total_cents: number;
  prices_tax_included: boolean;
  payment_method: "CASH" | "DEBIT";
  status: "COMPLETED" | "VOIDED";
  void_reason: string | null;
  voided_by: string | null;
  created_at: string;
};

export type SaleLineRow = {
  id: string;
  sale_id: string;
  sku: string;
  qty: number;
  unit_price_cents: number;
  price_source: string;
  line_total_cents: number;
};

export type DepositRow = {
  id: string;
  shift_id: string;
  staff_uid: string;
  amount_cents: number;
  note: string | null;
  created_at: string;
  /** Server-issued slip number. Missing on deposits saved before this field existed. */
  deposit_code?: string | null;
};

export type ClosingLine = {
  sku: string;
  name: string;
  left: number;
  system_qty: number;
  price_cents?: number;
  opening_qty?: number;
  received_qty?: number;
  sold_qty?: number;
  expected_qty?: number;
  variance_qty?: number;
  shortage_cents?: number;
  overage_cents?: number;
};

export type ClosingRow = {
  shift_id: string;
  sales_total_cents: number;
  cash_sales_cents?: number;
  debit_sales_cents?: number;
  sale_count: number;
  void_count: number;
  cash_on_hand_cents: number;
  deposited_cents: number;
  final_deposit_cents?: number;
  shortage_cents?: number;
  overage_cents?: number;
  /** PNY01 only. Opening verify, refill, and closing each keep their own dollars. The sums above include all three. */
  open_shortage_cents?: number;
  open_overage_cents?: number;
  refill_shortage_cents?: number;
  refill_overage_cents?: number;
  close_shortage_cents?: number;
  close_overage_cents?: number;
  balance_cents?: number;
  tickets_total: number;
  tickets_cashed_out: number;
  tickets_expired: number;
  closing_lines: ClosingLine[];
  sccx_ack_at: string | null;
  sccx_attempts: number;
  no_count: boolean;
  summary_text: string;
  created_at: string;
};

export type ClosingDraftRow = {
  shift_id: string;
  counts: { sku: string; counted_qty: number; edited_at?: string; expected_qty?: number; accepted_as_is?: boolean }[];
  opening_counts?: {
    sku: string;
    counted_qty: number;
    variance_reason?: string | null;
    expected_qty?: number;
    submitted_at?: string;
    edited_at?: string;
    added_stock?: boolean;
    accepted_as_is?: boolean;
  }[];
  /** Set when staff tap Submit, or when the 2-hour window closes the count for them. */
  verify_submitted_at?: string | null;
  /** Set when staff choose Yes on End Shift. Missing means the closing count has not started. */
  closing_started_at?: string | null;
  closing_submitted_at?: string | null;
  final_deposit_cents: number | null;
  final_deposit_code?: string | null;
  updated_at: string;
};

export type IdemRow = {
  scope: string;
  key: string;
  request_hash: string;
  response_json: string | null;
  public_json: unknown;
  status_code: number;
  purge_at: string | null;
  created_at: string;
};

export type OutboxRow = {
  id: string;
  tab: string;
  row_id: string;
  payload: Record<string, string>;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  status: "queued" | "sent" | "error";
  created_at: string;
};

export type CursorRow = {
  tab: string;
  last_row_number: number;
  last_polled_at: string | null;
  last_ok_at: string | null;
  last_full_scan_at: string | null;
};

export type AuditRow = {
  id: string;
  action: string;
  ref_type: string | null;
  ref_id: string | null;
  actor: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export type AdminSessionRow = {
  id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

export type State = {
  stores: StoreRow[];
  products: ProductRow[];
  store_products: StoreProductRow[];
  ledger: LedgerRow[];
  balances: BalanceRow[];
  staff: StaffRow[];
  shifts: ShiftRow[];
  sessions: SessionRow[];
  incoming: IncomingRow[];
  counts: CountRow[];
  count_lines: CountLineRow[];
  tickets: TicketRow[];
  ticket_lines: TicketLineRow[];
  sales: SaleRow[];
  sale_lines: SaleLineRow[];
  deposits: DepositRow[];
  closings: ClosingRow[];
  closing_drafts: ClosingDraftRow[];
  idempotency: IdemRow[];
  outbox: OutboxRow[];
  cursors: CursorRow[];
  audit: AuditRow[];
  admin_sessions: AdminSessionRow[];
  /** Last issued Deposit #. PNY-D0001 is 1. Missing on shifts saved before sequential numbers. */
  deposit_seq?: number;
  deposit_seq_pny02?: number;
};

/** Sheet cells are strings. `_sheet_row` is the 1-based sheet row, also stored as text so it fits the cell map. */
export type SheetRow = Record<string, string>;

export type Secrets = {
  shift: string;
  roster: string;
  poll: string;
  session: string;
  admin: string;
  cron: string;
};
