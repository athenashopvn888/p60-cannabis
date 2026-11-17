-- Restore the original Release 4-prep PNYS guard.
begin;

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

commit;

