begin;

create extension if not exists pgcrypto;

create schema if not exists pos_v2;
create schema if not exists pos_v2_hub;
revoke all on schema pos_v2 from public;
revoke all on schema pos_v2_hub from public;

create table pos_v2_hub.system_identity (
  singleton boolean primary key default true check (singleton),
  system_id text not null check (system_id = 'PNYS_V2_PREVIEW'),
  created_at timestamptz not null default now()
);

create table pos_v2_hub.store_runtime (
  store_code text primary key check (store_code ~ '^[A-Z0-9]{3,12}$'),
  write_mode text not null check (write_mode in ('ACTIVE','FROZEN','ARCHIVE_READ_ONLY')),
  active_generation bigint not null default 1 check (active_generation > 0),
  app_version text not null,
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1
);

create table pos_v2_hub.integration_owner (
  store_code text not null,
  channel text not null check (channel in ('SCCX_FEED','SCCX_ACK','SIGNAL','SHEET_OUTBOX','SHEET_IMPORT','STOCK_SNAPSHOT','SETB_SYNC','CLOSE_EMAIL')),
  generation bigint not null check (generation > 0),
  owner_deployment text not null,
  enabled boolean not null default false,
  lease_until timestamptz,
  primary key (store_code, channel),
  foreign key (store_code) references pos_v2_hub.store_runtime(store_code)
);

create table pos_v2_hub.store_sequences (
  store_code text not null references pos_v2_hub.store_runtime(store_code),
  sequence_name text not null,
  next_value bigint not null default 1 check (next_value > 0),
  primary key (store_code, sequence_name)
);

alter table pos_v2_hub.store_runtime enable row level security;
alter table pos_v2_hub.store_runtime force row level security;
create policy store_runtime_scope on pos_v2_hub.store_runtime
  using (store_code = nullif(current_setting('app.store_code', true), ''))
  with check (store_code = nullif(current_setting('app.store_code', true), ''));
alter table pos_v2_hub.integration_owner enable row level security;
alter table pos_v2_hub.integration_owner force row level security;
create policy integration_owner_scope on pos_v2_hub.integration_owner
  using (store_code = nullif(current_setting('app.store_code', true), ''))
  with check (store_code = nullif(current_setting('app.store_code', true), ''));
alter table pos_v2_hub.store_sequences enable row level security;
alter table pos_v2_hub.store_sequences force row level security;
create policy store_sequences_scope on pos_v2_hub.store_sequences
  using (store_code = nullif(current_setting('app.store_code', true), ''))
  with check (store_code = nullif(current_setting('app.store_code', true), ''));

create table pos_v2.stores (
  store_code text primary key references pos_v2_hub.store_runtime(store_code),
  display_name text not null,
  timezone text not null default 'America/Toronto',
  test_store boolean not null default false,
  created_at timestamptz not null default now(),
  row_version bigint not null default 1
);

create table pos_v2.store_settings (
  store_code text primary key references pos_v2.stores(store_code),
  opening_count_enabled boolean not null default true,
  dual_approval_threshold_cents bigint,
  audit_export_enabled boolean not null default false,
  correction_dual_approval_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1
);

create table pos_v2.staff (
  store_code text not null references pos_v2.stores(store_code),
  staff_id uuid not null,
  display_name text not null,
  pin_hash text not null check (pin_hash ~ '^scrypt[$][0-9a-f]+[$][0-9a-f]+$'),
  role text not null check (role in ('STAFF','KITCHEN','MANAGER','MASTER')),
  enabled boolean not null default true,
  row_version bigint not null default 1,
  primary key (store_code, staff_id)
);

create table pos_v2.catalog_items (
  store_code text not null references pos_v2.stores(store_code),
  sku text not null,
  name text not null,
  size_label text not null,
  tier text not null,
  thc boolean not null default false,
  price_cents bigint not null check (price_cents >= 0),
  enabled boolean not null default true,
  row_version bigint not null default 1,
  primary key (store_code, sku)
);

create table pos_v2.inventory_balances (
  store_code text not null,
  sku text not null,
  quantity bigint not null check (quantity >= 0),
  row_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (store_code, sku),
  foreign key (store_code, sku) references pos_v2.catalog_items(store_code, sku)
);

create table pos_v2.shifts (
  store_code text not null references pos_v2.stores(store_code),
  shift_id uuid not null,
  shift_code text not null,
  staff_id uuid not null,
  status text not null check (status in ('OPEN','CLOSING','CLOSED')),
  started_at timestamptz not null,
  ended_at timestamptz,
  row_version bigint not null default 1,
  imported_read_only boolean not null default false,
  primary key (store_code, shift_id),
  unique (store_code, shift_code),
  foreign key (store_code, staff_id) references pos_v2.staff(store_code, staff_id)
);

create table pos_v2.sales (
  store_code text not null,
  sale_id uuid not null,
  shift_id uuid not null,
  order_code text not null,
  payment_method text not null check (payment_method in ('CASH','DEBIT','ADJUSTMENT')),
  total_cents bigint not null,
  status text not null check (status in ('COMPLETED','VOIDED','RECONCILIATION_ADJUSTMENT')),
  created_at timestamptz not null,
  imported_read_only boolean not null default false,
  row_version bigint not null default 1,
  primary key (store_code, sale_id),
  unique (store_code, order_code),
  foreign key (store_code, shift_id) references pos_v2.shifts(store_code, shift_id)
);

create table pos_v2.sale_lines (
  store_code text not null,
  sale_id uuid not null,
  line_no integer not null check (line_no > 0),
  sku text not null,
  quantity bigint not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  primary key (store_code, sale_id, line_no),
  foreign key (store_code, sale_id) references pos_v2.sales(store_code, sale_id),
  foreign key (store_code, sku) references pos_v2.catalog_items(store_code, sku)
);

create table pos_v2.refills (
  store_code text not null,
  refill_id uuid not null,
  refill_code text not null,
  shift_id uuid,
  status text not null check (status in ('DRAFT','SENT','PARTIAL','ACCEPTED','REJECTED')),
  sent_by uuid not null,
  received_by uuid,
  sent_at timestamptz,
  received_at timestamptz,
  imported_read_only boolean not null default false,
  row_version bigint not null default 1,
  primary key (store_code, refill_id),
  unique (store_code, refill_code),
  foreign key (store_code, shift_id) references pos_v2.shifts(store_code, shift_id)
);

create table pos_v2.refill_lines (
  store_code text not null,
  refill_id uuid not null,
  line_no integer not null,
  sku text not null,
  sent_qty bigint not null check (sent_qty >= 0),
  received_qty bigint check (received_qty >= 0),
  variance_reason text,
  primary key (store_code, refill_id, line_no),
  foreign key (store_code, refill_id) references pos_v2.refills(store_code, refill_id),
  foreign key (store_code, sku) references pos_v2.catalog_items(store_code, sku)
);

create table pos_v2.close_versions (
  store_code text not null,
  close_id uuid not null,
  shift_id uuid not null,
  version integer not null check (version > 0),
  input_json jsonb not null,
  result_json jsonb not null,
  parity_hash text not null check (parity_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null,
  correction_id uuid,
  imported_read_only boolean not null default false,
  primary key (store_code, close_id, version),
  unique (store_code, shift_id, version),
  foreign key (store_code, shift_id) references pos_v2.shifts(store_code, shift_id)
);

create table pos_v2.close_lines (
  store_code text not null,
  close_id uuid not null,
  version integer not null,
  sku text not null,
  expected_qty bigint not null,
  counted_qty bigint not null,
  unit_price_cents bigint not null,
  qty_diff bigint not null,
  value_diff_cents bigint not null,
  primary key (store_code, close_id, version, sku),
  foreign key (store_code, close_id, version) references pos_v2.close_versions(store_code, close_id, version)
);

create table pos_v2.inventory_movements (
  store_code text not null,
  movement_id uuid not null,
  sku text not null,
  quantity_delta bigint not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in ('SALE','REFILL','COUNT','CORRECTION','UNDO')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  primary key (store_code, movement_id),
  unique (store_code, movement_type, source_id, sku),
  foreign key (store_code, sku) references pos_v2.catalog_items(store_code, sku)
);

create table pos_v2.corrections (
  store_code text not null,
  correction_id uuid not null,
  idempotency_key text not null,
  kind text not null check (kind in ('STOCK_FOUND','STOCK_ADJUST','SHIFT_TIME','MONEY','CLOSE_RECALCULATE')),
  shift_id uuid not null,
  target_entity text not null,
  target_field text not null,
  reason text not null check (length(trim(reason)) >= 5),
  status text not null check (status in ('PREVIEWED','QUEUED_ACTIVE_SHIFT','APPLIED','UNDONE','FAILED')),
  expected_version bigint not null,
  before_json jsonb not null,
  after_json jsonb not null,
  preview_hash text not null,
  actor_id text not null,
  actor_kind text not null check (actor_kind in ('HUMAN_MASTER','AI_MASTER')),
  tri_requested boolean not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz,
  primary key (store_code, correction_id),
  unique (store_code, idempotency_key),
  foreign key (store_code, shift_id) references pos_v2.shifts(store_code, shift_id)
);

create unique index corrections_one_active_per_close on pos_v2.corrections(store_code, shift_id)
  where status in ('PREVIEWED','QUEUED_ACTIVE_SHIFT','APPLIED') and kind in ('MONEY','CLOSE_RECALCULATE');

create table pos_v2.correction_snapshots (
  store_code text not null,
  correction_id uuid not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (store_code, correction_id),
  foreign key (store_code, correction_id) references pos_v2.corrections(store_code, correction_id)
);

create table pos_v2.correction_audit (
  store_code text not null,
  audit_id uuid not null,
  correction_id uuid not null,
  action text not null check (action in ('PREVIEW','APPLY','QUEUE','UNDO','SEND_CORRECTED_REPORT')),
  actor_id text not null,
  actor_kind text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (store_code, audit_id),
  foreign key (store_code, correction_id) references pos_v2.corrections(store_code, correction_id)
);

create table pos_v2.report_outbox (
  store_code text not null,
  outbox_id uuid not null,
  close_id uuid not null,
  close_version integer not null,
  correction_id uuid,
  recipient_key text not null,
  subject text not null,
  body_text text not null,
  xlsx_bytes bytea not null,
  parity_hash text not null,
  approved_by text,
  approved_at timestamptz,
  status text not null check (status in ('DRAFT','APPROVED','SENDING','SENT','FAILED')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (store_code, outbox_id),
  unique (store_code, close_id, close_version, recipient_key, parity_hash),
  foreign key (store_code, close_id, close_version) references pos_v2.close_versions(store_code, close_id, version)
);

create table pos_v2.import_batches (
  store_code text not null references pos_v2.stores(store_code),
  import_id uuid not null,
  source_system text not null,
  source_checksum text not null,
  row_counts jsonb not null,
  immutable boolean not null default true check (immutable),
  imported_at timestamptz not null default now(),
  primary key (store_code, import_id),
  unique (store_code, source_system, source_checksum)
);

do $$
declare t text;
begin
  foreach t in array array[
    'stores','store_settings','staff','catalog_items','inventory_balances','shifts','sales','sale_lines','refills','refill_lines',
    'close_versions','close_lines','inventory_movements','corrections','correction_snapshots','correction_audit','report_outbox','import_batches'
  ] loop
    execute format('alter table pos_v2.%I enable row level security', t);
    execute format('alter table pos_v2.%I force row level security', t);
    execute format('create policy %I_store_scope on pos_v2.%I using (store_code = nullif(current_setting(''app.store_code'', true), '''')) with check (store_code = nullif(current_setting(''app.store_code'', true), ''''))', t, t);
  end loop;
end $$;

create or replace function pos_v2.require_master(store text, tri_required boolean default false) returns void
language plpgsql security invoker as $$
declare actor_kind text := nullif(current_setting('app.actor_kind', true), '');
declare actor_store text := nullif(current_setting('app.store_code', true), '');
begin
  if actor_kind not in ('HUMAN_MASTER','AI_MASTER') or actor_store is distinct from store then raise exception 'FORBIDDEN_MASTER_SCOPE'; end if;
  if actor_kind = 'AI_MASTER' and tri_required and nullif(current_setting('app.tri_requested', true), '') is distinct from 'true' then raise exception 'AI_PREVIEW_ONLY'; end if;
end $$;

create or replace function pos_v2.preview_correction(payload jsonb) returns jsonb
language plpgsql security invoker as $$
declare store text := payload->>'storeCode';
declare cid uuid := gen_random_uuid();
declare actor text := nullif(current_setting('app.actor_id', true), '');
declare actor_kind text := nullif(current_setting('app.actor_kind', true), '');
begin
  perform pos_v2.require_master(store, false);
  if length(trim(coalesce(payload->>'reason',''))) < 5 then raise exception 'CORRECTION_REASON_REQUIRED'; end if;
  return jsonb_build_object('previewId', cid, 'storeCode', store, 'actor', actor, 'actorKind', actor_kind, 'status', 'PREVIEW_ONLY', 'payload', payload);
end $$;

create or replace function pos_v2.apply_correction(payload jsonb) returns jsonb
language plpgsql security invoker as $$
declare store text := payload->>'storeCode';
begin
  perform pos_v2.require_master(store, true);
  raise exception 'V2_APPLY_NOT_ENABLED_UNTIL_STAGING_RESTORE_DRILL';
end $$;

create or replace function pos_v2.undo_correction(payload jsonb) returns jsonb
language plpgsql security invoker as $$
declare store text := payload->>'storeCode';
begin
  perform pos_v2.require_master(store, true);
  raise exception 'V2_UNDO_NOT_ENABLED_UNTIL_STAGING_RESTORE_DRILL';
end $$;

insert into pos_v2_hub.system_identity(singleton, system_id) values (true, 'PNYS_V2_PREVIEW')
on conflict (singleton) do update set system_id = excluded.system_id;

commit;
