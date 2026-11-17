-- PNYS Kitchen proof recovery only. Never reads or writes pny_pos.
-- The normal proof cleanup already restored this backup and FROZEN mode.
-- Run only if the DRY_KITCHEN_BACKUP audit row is still the intended restore point.
begin;

do $guard$
begin
  if not exists (
    select 1 from pos_hub.policy_audit
    where id='4b0b0000-0000-4000-8000-000000000001'::uuid
      and store_code='PNYS'
      and policy_key='DRY_KITCHEN_BACKUP'
  ) then
    raise exception 'PNYS_KITCHEN_PROOF_BACKUP_MISSING';
  end if;
end
$guard$;

update pos_hub.store_runtime
set write_mode='ACTIVE',changed_at=now(),changed_by='Codex for Tri - Kitchen proof undo'
where store_code='PNYS';

select set_config('app.store_code','PNYS',true),
       set_config('app.generation',(select generation::text from pos_hub.store_runtime where store_code='PNYS'),true);

update pnys_pos.live_state state
set doc=backup.old_value,
    version=(backup.new_value->>'version')::bigint,
    updated_at=(backup.new_value->>'updated_at')::timestamptz
from pos_hub.policy_audit backup
where state.store_code='PNYS'
  and backup.id='4b0b0000-0000-4000-8000-000000000001'::uuid
  and backup.policy_key='DRY_KITCHEN_BACKUP';

update pos_hub.store_runtime
set write_mode='FROZEN',changed_at=now(),changed_by='Codex for Tri - Kitchen proof undo complete'
where store_code='PNYS';

commit;
