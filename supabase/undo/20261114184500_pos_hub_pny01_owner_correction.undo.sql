-- Guarded undo for the PNY01 owner correction.
-- Restores the exact captured control state. Never reads or writes pny_pos.
begin;

lock table pos_hub.store, pos_hub.store_runtime, pos_hub.integration_owner,
  pos_hub.policy_audit in share row exclusive mode;

do $guard$
begin
  if not exists (
    select 1 from pos_hub.store_runtime
    where store_code='PNY01' and write_mode='ACTIVE' and generation=1
      and cutover_id='PNY01-BRIDGE-PREVIEW' and changed_by='Codex for Tri'
  ) or not exists (
    select 1 from pos_hub.store_runtime
    where store_code='PNYS' and write_mode='FROZEN' and generation=1
      and cutover_id='PNY01-BRIDGE-PREVIEW' and changed_by='Codex for Tri'
  ) then
    raise exception 'Undo refused: runtime state changed after correction';
  end if;

  if (select count(*) from pos_hub.integration_owner
      where owner_store_code='PNY01' and generation=1 and enabled=true
        and cutover_id='PNY01-BRIDGE-PREVIEW' and switched_by='Codex for Tri') <> 7 then
    raise exception 'Undo refused: integration ownership changed after correction';
  end if;
end
$guard$;

update pos_hub.integration_owner
set owner_store_code='PNYS',
    generation=1,
    enabled=true,
    cutover_id='PNYS-R4-PREP',
    switched_at='2026-11-14 07:08:47.027806+00'::timestamptz,
    switched_by='RELEASE4_PREP';

update pos_hub.store_runtime
set write_mode='ACTIVE',
    generation=1,
    cutover_id='PNYS-R4-PREP',
    changed_at='2026-11-14 07:08:47.027806+00'::timestamptz,
    changed_by='RELEASE4_PREP'
where store_code='PNYS';

delete from pos_hub.store_runtime
where store_code='PNY01' and cutover_id='PNY01-BRIDGE-PREVIEW' and changed_by='Codex for Tri';

delete from pos_hub.policy_audit
where id in (
  md5('PNY01-BRIDGE-PREVIEW:runtime:PNY01')::uuid,
  md5('PNY01-BRIDGE-PREVIEW:runtime:PNYS')::uuid
)
or id in (
  select md5('PNY01-BRIDGE-PREVIEW:owner:' || channel)::uuid
  from unnest(array['SCCX_FEED','SCCX_ACK','SIGNAL','SHEET_OUTBOX','SHEET_IMPORT','STOCK_SNAPSHOT','SETB_SYNC']) channel
);

delete from pos_hub.store
where store_code='PNY01'
  and not exists (select 1 from pos_hub.store_runtime where store_code='PNY01')
  and not exists (select 1 from pos_hub.store_policy where store_code='PNY01')
  and not exists (select 1 from pos_hub.policy_audit where store_code='PNY01')
  and not exists (select 1 from pos_hub.customer where created_store_code='PNY01');

commit;

