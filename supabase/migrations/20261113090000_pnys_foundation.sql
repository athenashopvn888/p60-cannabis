-- PNYS Release 1. This migration never writes to pny_pos.
begin;

create schema if not exists pnys_pos;
create schema if not exists pos_hub;

create table if not exists pnys_pos.live_state (
  store_code text primary key check (store_code = 'PNYS'),
  version bigint not null default 0,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists pnys_pos.shift (
  store_code text not null check (store_code = 'PNYS'), id text not null,
  staff_uid text not null, status text not null, started_at timestamptz not null,
  ended_at timestamptz, doc jsonb not null, primary key (store_code,id)
);
create table if not exists pnys_pos.sale (
  store_code text not null check (store_code = 'PNYS'), id text not null,
  shift_id text not null, payment_method text not null, status text not null,
  total_cents integer not null, created_at timestamptz not null, doc jsonb not null,
  primary key (store_code,id)
);
create table if not exists pnys_pos.deposit (
  store_code text not null check (store_code = 'PNYS'), id text not null,
  shift_id text not null, amount_cents integer not null, deposit_code text,
  created_at timestamptz not null, doc jsonb not null, primary key (store_code,id)
);
create table if not exists pnys_pos.stock_count (
  store_code text not null check (store_code = 'PNYS'), id text not null,
  shift_id text not null, kind text not null, doc jsonb not null, primary key (store_code,id)
);
create table if not exists pnys_pos.refill (
  store_code text not null check (store_code = 'PNYS'), kitchen_row_id text not null,
  sku text not null, qty_sent integer not null, status text not null, doc jsonb not null,
  primary key (store_code,kitchen_row_id)
);
create table if not exists pnys_pos.closing (
  store_code text not null check (store_code = 'PNYS'), shift_id text not null,
  float_cents integer not null, deposited_cents integer not null,
  cash_sales_cents integer not null, doc jsonb not null, primary key (store_code,shift_id)
);

create table if not exists pnys_pos.clone_audit (
  clone_id uuid primary key,
  source_store text not null check (source_store = 'PNY01'),
  target_store text not null check (target_store = 'PNYS'),
  source_version bigint not null,
  source_counts jsonb not null,
  target_counts jsonb not null,
  source_checksum text not null,
  target_checksum text not null,
  reconciled boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists pos_hub.store (
  store_code text primary key, display_name text not null, active boolean not null default true,
  test_store boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into pos_hub.store(store_code,display_name,test_store) values ('PNYS','PNYS',true)
on conflict (store_code) do nothing;

create table if not exists pos_hub.store_policy (
  store_code text primary key references pos_hub.store(store_code),
  opening_count_required boolean not null default false,
  closing_count_required boolean not null default true,
  updated_by text, updated_at timestamptz not null default now()
);
insert into pos_hub.store_policy(store_code,opening_count_required,closing_count_required)
values ('PNYS',false,true) on conflict (store_code) do nothing;

create table if not exists pos_hub.policy_audit (
  id uuid primary key, store_code text not null references pos_hub.store(store_code),
  policy_key text not null, old_value jsonb, new_value jsonb not null,
  changed_by text not null, changed_at timestamptz not null default now()
);
create table if not exists pos_hub.customer (
  id uuid primary key, phone_e164 text unique, display_name text,
  created_store_code text references pos_hub.store(store_code),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists pos_hub.customer_consent (
  id uuid primary key, customer_id uuid not null references pos_hub.customer(id),
  channel text not null check (channel in ('SMS')), consented boolean not null,
  store_code text not null references pos_hub.store(store_code),
  recorded_at timestamptz not null default now(), source text not null
);
create table if not exists pos_hub.customer_opt_out (
  id uuid primary key, customer_id uuid not null references pos_hub.customer(id),
  channel text not null check (channel in ('SMS')), keyword text not null default 'STOP',
  recorded_at timestamptz not null default now()
);
create table if not exists pos_hub.coupon (
  id uuid primary key, code text unique not null, active boolean not null default false,
  definition jsonb not null, starts_at timestamptz, ends_at timestamptz,
  created_by text not null, created_at timestamptz not null default now()
);
create table if not exists pos_hub.coupon_redemption (
  id uuid primary key, coupon_id uuid not null references pos_hub.coupon(id),
  customer_id uuid references pos_hub.customer(id), store_code text not null references pos_hub.store(store_code),
  shift_id text not null, sale_id text not null, discount_cents integer not null,
  redeemed_at timestamptz not null default now(), unique(store_code,sale_id,coupon_id)
);

revoke all on schema pnys_pos from public;
revoke all on schema pos_hub from public;
revoke all on all tables in schema pnys_pos from public;
revoke all on all tables in schema pos_hub from public;

commit;
