/** Relational projection of the PNY till. Applied in the same transaction as the ledger. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pny_state (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stores (
  code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL,
  timezone text NOT NULL,
  prices_tax_included boolean NOT NULL DEFAULT true,
  ticket_letter_seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  sku text PRIMARY KEY,
  sku_sort bigint NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  default_price_cents integer NOT NULL,
  image_url text,
  setb_active boolean NOT NULL,
  synced_at timestamptz,
  created_at timestamptz NOT NULL
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS store_products (
  store_code text NOT NULL,
  sku text NOT NULL,
  enabled boolean NOT NULL,
  price_override_cents integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (store_code, sku)
);

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id uuid PRIMARY KEY,
  sku text NOT NULL,
  qty_delta integer NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('OPENING_BALANCE', 'INCOMING_CONFIRM', 'SALE', 'VOID', 'ADJUSTMENT', 'COUNT_VARIANCE')),
  ref_type text,
  ref_id text,
  actor text,
  reason text,
  shift_id uuid,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS store_balance (
  sku text PRIMARY KEY,
  qty integer NOT NULL CHECK (qty >= 0),
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  staff_uid text PRIMARY KEY,
  sccx_id text,
  pos_id text,
  display_name text NOT NULL,
  active boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY,
  sccx_shift_id text NOT NULL UNIQUE,
  staff_uid text NOT NULL,
  store_code text NOT NULL,
  ticket_letter text NOT NULL,
  ticket_seq integer NOT NULL DEFAULT 0,
  pin_hash text,
  pin_expires_at timestamptz,
  pin_failed_attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text,
  opening_confirmed_at timestamptz,
  refill_confirmed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open ON shifts (store_code) WHERE status IN ('ACTIVE', 'CLOSING');

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  shift_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS incoming_batches (
  kitchen_row_id uuid PRIMARY KEY,
  batch_id text,
  store_code text NOT NULL,
  sku text NOT NULL,
  qty_sent integer NOT NULL,
  kind text NOT NULL,
  kitchen_created_at timestamptz,
  imported_at timestamptz NOT NULL,
  status text NOT NULL,
  qty_received integer,
  variance_reason text,
  confirmed_shift_id uuid,
  confirmed_at timestamptz,
  linked_ledger_id uuid,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id uuid PRIMARY KEY,
  shift_id uuid NOT NULL,
  kind text NOT NULL,
  confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id uuid PRIMARY KEY,
  count_id uuid NOT NULL,
  sku text NOT NULL,
  system_qty integer NOT NULL,
  counted_qty integer NOT NULL,
  variance_reason text
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY,
  shift_id uuid NOT NULL,
  code text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (shift_id, code)
);

CREATE TABLE IF NOT EXISTS ticket_lines (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL,
  sku text NOT NULL,
  qty integer NOT NULL,
  unit_price_cents_snapshot integer NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY,
  ref_no text NOT NULL UNIQUE,
  shift_id uuid NOT NULL,
  staff_uid text NOT NULL,
  ticket_id uuid,
  total_cents integer NOT NULL,
  prices_tax_included boolean NOT NULL,
  payment_method text NOT NULL,
  status text NOT NULL,
  void_reason text,
  voided_by text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id uuid PRIMARY KEY,
  sale_id uuid NOT NULL,
  sku text NOT NULL,
  qty integer NOT NULL,
  unit_price_cents integer NOT NULL,
  price_source text NOT NULL,
  line_total_cents integer NOT NULL
);

CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY,
  shift_id uuid NOT NULL,
  staff_uid text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  note text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_closings (
  shift_id uuid PRIMARY KEY,
  sales_total_cents integer NOT NULL,
  sale_count integer NOT NULL,
  void_count integer NOT NULL,
  cash_on_hand_cents integer NOT NULL,
  deposited_cents integer NOT NULL,
  tickets_total integer NOT NULL,
  tickets_cashed_out integer NOT NULL,
  tickets_expired integer NOT NULL,
  closing_lines jsonb NOT NULL,
  sccx_ack_at timestamptz,
  sccx_attempts integer NOT NULL DEFAULT 0,
  no_count boolean NOT NULL DEFAULT false,
  summary_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);

ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS cash_sales_cents integer NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS debit_sales_cents integer NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS final_deposit_cents integer NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS shortage_cents integer NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS overage_cents integer NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS closing_drafts (
  shift_id uuid PRIMARY KEY,
  counts jsonb NOT NULL,
  final_deposit_cents integer,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb,
  public_json jsonb,
  status_code integer NOT NULL,
  purge_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS sheet_outbox (
  id uuid PRIMARY KEY,
  tab text NOT NULL,
  row_id text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sheet_import_cursor (
  tab text PRIMARY KEY,
  last_row_number integer NOT NULL DEFAULT 0,
  last_polled_at timestamptz,
  last_ok_at timestamptz,
  last_full_scan_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY,
  action text NOT NULL,
  ref_type text,
  ref_id text,
  actor text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
`;
