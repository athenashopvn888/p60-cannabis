-- PREPARED ONLY. Do not run while a PNY01 shift is open.
-- Restores the exact two pre-change live_state documents. It fails closed if
-- either store has moved past the single prepared update.
begin;

do $guard$
begin
  if exists (
    select 1 from pny_pos.live_state s,
      jsonb_array_elements(s.doc->'shifts') shift
    where s.store_code='PNY01' and shift->>'status' in ('ACTIVE','LOCKED','CLOSING')
  ) then raise exception 'PNY01_SHIFT_OPEN'; end if;
  if exists (
    select 1 from pnys_pos.live_state s,
      jsonb_array_elements(s.doc->'shifts') shift
    where s.store_code='PNYS' and shift->>'status' in ('ACTIVE','LOCKED','CLOSING')
  ) then raise exception 'PNYS_SHIFT_OPEN'; end if;
end
$guard$;

update pos_hub.store_runtime
set write_mode='ACTIVE',changed_at=now(),changed_by='Codex for Tri - gummy recovery undo'
where store_code='PNYS' and write_mode='FROZEN';

do $mode_guard$
begin
  if (select write_mode from pos_hub.store_runtime where store_code='PNYS') <> 'ACTIVE'
    then raise exception 'PNYS_NOT_ACTIVE_FOR_UNDO'; end if;
end
$mode_guard$;

select set_config('app.store_code','PNYS',true),
       set_config('app.generation',(select generation::text from pos_hub.store_runtime where store_code='PNYS'),true);

do $restore$
declare
  pny_backup pos_hub.policy_audit%rowtype;
  pnys_backup pos_hub.policy_audit%rowtype;
begin
  select * into strict pny_backup from pos_hub.policy_audit
  where id='65665701-1115-4000-a000-000000000001'::uuid
    and policy_key='PNY_GUMMY_CATALOG_REFILL_BACKUP';
  select * into strict pnys_backup from pos_hub.policy_audit
  where id='65665702-1115-4000-a000-000000000001'::uuid
    and policy_key='PNY_GUMMY_CATALOG_REFILL_BACKUP';

  if (select version from pny_pos.live_state where store_code='PNY01') <> (pny_backup.new_value->>'version')::bigint + 1
    then raise exception 'PNY01_CHANGED_AFTER_FIX'; end if;
  if (select version from pnys_pos.live_state where store_code='PNYS') <> (pnys_backup.new_value->>'version')::bigint + 1
    then raise exception 'PNYS_CHANGED_AFTER_FIX'; end if;

  update pny_pos.live_state
  set doc=pny_backup.old_value,
      version=(pny_backup.new_value->>'version')::bigint,
      updated_at=(pny_backup.new_value->>'updated_at')::timestamptz
  where store_code='PNY01';
  update pnys_pos.live_state
  set doc=pnys_backup.old_value,
      version=(pnys_backup.new_value->>'version')::bigint,
      updated_at=(pnys_backup.new_value->>'updated_at')::timestamptz
  where store_code='PNYS';
end
$restore$;

update pos_hub.store_runtime
set write_mode='FROZEN',changed_at=now(),changed_by='Codex for Tri - gummy recovery undo complete'
where store_code='PNYS';

commit;
