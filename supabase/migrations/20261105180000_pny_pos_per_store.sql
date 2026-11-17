-- Per-store POS state for Supabase project pny-pos (ref eboqxdxwtilkwwqinfnj, ca-central-1).
-- Does not read or write the Google sheet.
-- pny01_till can see only PNY01. pny02_till can see only PNY02.
-- Passwords are not in this file. Set them outside the repo.

create schema if not exists pny_pos;

create or replace function pny_pos.app_store()
returns text
language sql
stable
as $$
  select case current_user
    when 'pny01_till' then 'PNY01'
    when 'pny02_till' then 'PNY02'
    else null
  end
$$;

create table if not exists pny_pos.live_state (
  store_code text primary key check (store_code in ('PNY01', 'PNY02')),
  version bigint not null default 0,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into pny_pos.live_state (store_code, version, doc)
values ('PNY01', 0, '{}'::jsonb), ('PNY02', 0, '{}'::jsonb)
on conflict (store_code) do nothing;

comment on table pny_pos.live_state is
  'Optimistic lock. A write updates the row only when version still matches the read.';

create table if not exists pny_pos.shift (
  store_code text not null check (store_code in ('PNY01', 'PNY02')),
  id text not null,
  staff_uid text not null,
  status text not null,
  started_at timestamptz,
  ended_at timestamptz,
  doc jsonb not null,
  primary key (store_code, id)
);

create table if not exists pny_pos.sale (
  store_code text not null check (store_code in ('PNY01', 'PNY02')),
  id text not null,
  shift_id text not null,
  payment_method text not null,
  status text not null,
  total_cents integer not null,
  created_at timestamptz,
  doc jsonb not null,
  primary key (store_code, id)
);

create table if not exists pny_pos.deposit (
  store_code text not null check (store_code in ('PNY01', 'PNY02')),
  id text not null,
  shift_id text not null,
  amount_cents integer not null,
  deposit_code text,
  created_at timestamptz,
  doc jsonb not null,
  primary key (store_code, id)
);

create table if not exists pny_pos.stock_count (
  store_code text not null check (store_code in ('PNY01', 'PNY02')),
  id text not null,
  shift_id text not null,
  kind text not null,
  doc jsonb not null,
  primary key (store_code, id)
);

create table if not exists pny_pos.refill (
  store_code text not null check (store_code in ('PNY01', 'PNY02')),
  kitchen_row_id text not null,
  sku text not null,
  qty_sent integer not null,
  status text not null,
  doc jsonb not null,
  primary key (store_code, kitchen_row_id)
);

create table if not exists pny_pos.closing (
  store_code text not null check (store_code in ('PNY01', 'PNY02')),
  shift_id text not null,
  float_cents integer not null default 0,
  deposited_cents integer not null default 0,
  cash_sales_cents integer not null default 0,
  doc jsonb not null,
  primary key (store_code, shift_id)
);

do $$
declare
  rel text;
begin
  foreach rel in array array['live_state','shift','sale','deposit','stock_count','refill','closing']
  loop
    execute format('alter table pny_pos.%I enable row level security', rel);
    execute format('drop policy if exists store_scope on pny_pos.%I', rel);
    execute format(
      'create policy store_scope on pny_pos.%I for all using (store_code = pny_pos.app_store()) with check (store_code = pny_pos.app_store())',
      rel
    );
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pny01_till') then
    create role pny01_till nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'pny02_till') then
    create role pny02_till nologin;
  end if;
end $$;

grant usage on schema pny_pos to pny01_till, pny02_till;
grant select, insert, update, delete on all tables in schema pny_pos to pny01_till, pny02_till;
revoke all on schema pny_pos from public;
revoke all on all tables in schema pny_pos from public;
