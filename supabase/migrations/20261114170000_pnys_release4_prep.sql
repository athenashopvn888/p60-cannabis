-- PNYS Release 4 preparation. PNYS/pos_hub only; never reads or writes pny_pos.
begin;

create table if not exists pos_hub.store_runtime (
  store_code text primary key references pos_hub.store(store_code),
  write_mode text not null check (write_mode in ('ACTIVE','FROZEN','ARCHIVE_READ_ONLY')),
  generation bigint not null check (generation >= 1),
  cutover_id text,
  changed_at timestamptz not null default now(),
  changed_by text not null
);

create table if not exists pos_hub.integration_owner (
  channel text primary key check (channel in ('SCCX_FEED','SCCX_ACK','SIGNAL','SHEET_OUTBOX','SHEET_IMPORT','STOCK_SNAPSHOT','SETB_SYNC')),
  owner_store_code text not null references pos_hub.store(store_code),
  generation bigint not null check (generation >= 1),
  enabled boolean not null default false,
  cutover_id text not null,
  switched_at timestamptz not null default now(),
  switched_by text not null
);

create table if not exists pos_hub.integration_delivery (
  id uuid primary key default gen_random_uuid(),
  channel text not null references pos_hub.integration_owner(channel),
  cutover_id text not null,
  event_id text not null,
  owner_store_code text not null references pos_hub.store(store_code),
  generation bigint not null check (generation >= 1),
  delivered_at timestamptz not null default now(),
  receipt jsonb not null default '{}'::jsonb,
  unique (channel, cutover_id, event_id)
);

insert into pos_hub.store_runtime(store_code,write_mode,generation,cutover_id,changed_by)
values ('PNYS','ACTIVE',1,'PNYS-R4-PREP','RELEASE4_PREP')
on conflict (store_code) do nothing;

insert into pos_hub.integration_owner(channel,owner_store_code,generation,enabled,cutover_id,switched_by)
select channel,'PNYS',1,true,'PNYS-R4-PREP','RELEASE4_PREP'
from unnest(array['SCCX_FEED','SCCX_ACK','SIGNAL','SHEET_OUTBOX','SHEET_IMPORT','STOCK_SNAPSHOT','SETB_SYNC']) as channel
on conflict (channel) do nothing;

create or replace function pos_hub.guard_pnys_live_state_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pos_hub
as $guard$
declare
  target_store text := coalesce(new.store_code, old.store_code);
  mode text;
  expected_generation bigint;
  session_store text := current_setting('app.store_code', true);
  session_generation bigint := nullif(current_setting('app.generation', true), '')::bigint;
begin
  if target_store <> 'PNYS' then
    raise exception using errcode = 'P0001', message = 'PNYS_ONLY_GUARD';
  end if;
  select write_mode, generation into mode, expected_generation
  from pos_hub.store_runtime where store_code = target_store;
  if mode is distinct from 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'PNYS_WRITE_FROZEN';
  end if;
  if session_store is distinct from target_store or session_generation is distinct from expected_generation then
    raise exception using errcode = 'P0001', message = 'PNYS_STALE_DEPLOYMENT';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$guard$;

drop trigger if exists pnys_live_state_write_guard on pnys_pos.live_state;
create trigger pnys_live_state_write_guard
before insert or update or delete on pnys_pos.live_state
for each row execute function pos_hub.guard_pnys_live_state_write();

revoke all on pos_hub.store_runtime, pos_hub.integration_owner, pos_hub.integration_delivery from public;
grant select on pos_hub.store_runtime, pos_hub.integration_owner to pnys_app;
grant select, insert on pos_hub.integration_delivery to pnys_app;

alter table pos_hub.store_runtime enable row level security;
alter table pos_hub.store_runtime force row level security;
alter table pos_hub.integration_owner enable row level security;
alter table pos_hub.integration_owner force row level security;
alter table pos_hub.integration_delivery enable row level security;
alter table pos_hub.integration_delivery force row level security;

drop policy if exists pnys_app_read_store_runtime on pos_hub.store_runtime;
create policy pnys_app_read_store_runtime on pos_hub.store_runtime
  for select to pnys_app using (store_code = 'PNYS');

drop policy if exists pnys_app_read_integration_owner on pos_hub.integration_owner;
create policy pnys_app_read_integration_owner on pos_hub.integration_owner
  for select to pnys_app using (owner_store_code = 'PNYS');

drop policy if exists pnys_app_read_delivery on pos_hub.integration_delivery;
create policy pnys_app_read_delivery on pos_hub.integration_delivery
  for select to pnys_app using (owner_store_code = 'PNYS');

drop policy if exists pnys_app_insert_delivery on pos_hub.integration_delivery;
create policy pnys_app_insert_delivery on pos_hub.integration_delivery
  for insert to pnys_app with check (owner_store_code = 'PNYS');

commit;
