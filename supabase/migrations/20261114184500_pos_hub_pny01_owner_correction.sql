-- Guarded control-row correction only.
-- Writes pos_hub.store, pos_hub.store_runtime, pos_hub.integration_owner,
-- and pos_hub.policy_audit. Never reads or writes pny_pos and changes no grants.
begin;

lock table pos_hub.store, pos_hub.store_runtime, pos_hub.integration_owner,
  pos_hub.policy_audit in share row exclusive mode;

do $guard$
declare
  owner_count integer;
  min_generation bigint;
  max_generation bigint;
begin
  select count(*), min(generation), max(generation)
    into owner_count, min_generation, max_generation
  from pos_hub.integration_owner;

  if owner_count <> 7 or min_generation <> 1 or max_generation <> 1 then
    raise exception 'Control correction refused: expected seven generation-1 owners';
  end if;

  if exists (
    select 1 from pos_hub.integration_owner
    where owner_store_code <> 'PNYS'
       or enabled is not true
       or cutover_id <> 'PNYS-R4-PREP'
       or switched_by <> 'RELEASE4_PREP'
  ) then
    raise exception 'Control correction refused: owner pre-state changed';
  end if;

  if not exists (
    select 1 from pos_hub.store_runtime
    where store_code = 'PNYS'
      and write_mode = 'ACTIVE'
      and generation = 1
      and cutover_id = 'PNYS-R4-PREP'
      and changed_by = 'RELEASE4_PREP'
  ) then
    raise exception 'Control correction refused: PNYS runtime pre-state changed';
  end if;

  if exists (select 1 from pos_hub.store_runtime where store_code = 'PNY01') then
    raise exception 'Control correction refused: PNY01 runtime already exists';
  end if;
end
$guard$;

insert into pos_hub.store(store_code, display_name, active, test_store, created_at, updated_at)
values ('PNY01', 'PNY01', true, false, now(), now())
on conflict (store_code) do update
set active = true,
    test_store = false,
    updated_at = now();

insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
values
  (md5('PNY01-BRIDGE-PREVIEW:runtime:PNY01')::uuid, 'PNY01', 'store_runtime.write_mode', null,
   jsonb_build_object('write_mode','ACTIVE','generation',1,'cutover_id','PNY01-BRIDGE-PREVIEW'), 'Codex for Tri'),
  (md5('PNY01-BRIDGE-PREVIEW:runtime:PNYS')::uuid, 'PNYS', 'store_runtime.write_mode',
   jsonb_build_object('write_mode','ACTIVE','generation',1,'cutover_id','PNYS-R4-PREP'),
   jsonb_build_object('write_mode','FROZEN','generation',1,'cutover_id','PNY01-BRIDGE-PREVIEW'), 'Codex for Tri');

insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
select md5('PNY01-BRIDGE-PREVIEW:owner:' || channel)::uuid,
       'PNY01',
       'integration_owner.' || channel,
       jsonb_build_object('owner_store_code',owner_store_code,'generation',generation,'enabled',enabled,
                          'cutover_id',cutover_id,'switched_at',switched_at,'switched_by',switched_by),
       jsonb_build_object('owner_store_code','PNY01','generation',1,'enabled',true,
                          'cutover_id','PNY01-BRIDGE-PREVIEW','switched_by','Codex for Tri'),
       'Codex for Tri'
from pos_hub.integration_owner;

insert into pos_hub.store_runtime(store_code, write_mode, generation, cutover_id, changed_at, changed_by)
values ('PNY01', 'ACTIVE', 1, 'PNY01-BRIDGE-PREVIEW', now(), 'Codex for Tri');

update pos_hub.store_runtime
set write_mode = 'FROZEN',
    generation = 1,
    cutover_id = 'PNY01-BRIDGE-PREVIEW',
    changed_at = now(),
    changed_by = 'Codex for Tri'
where store_code = 'PNYS';

update pos_hub.integration_owner
set owner_store_code = 'PNY01',
    generation = 1,
    enabled = true,
    cutover_id = 'PNY01-BRIDGE-PREVIEW',
    switched_at = now(),
    switched_by = 'Codex for Tri';

do $verify$
begin
  if (select count(*) from pos_hub.store_runtime
      where (store_code='PNY01' and write_mode='ACTIVE' and generation=1)
         or (store_code='PNYS' and write_mode='FROZEN' and generation=1)) <> 2 then
    raise exception 'Control correction verification failed: runtime rows';
  end if;

  if (select count(*) from pos_hub.integration_owner
      where owner_store_code='PNY01' and generation=1 and enabled=true
        and cutover_id='PNY01-BRIDGE-PREVIEW') <> 7 then
    raise exception 'Control correction verification failed: owner rows';
  end if;

  if (select count(*) from pos_hub.policy_audit
      where changed_by='Codex for Tri'
        and (policy_key='store_runtime.write_mode' or policy_key like 'integration_owner.%')) <> 9 then
    raise exception 'Control correction verification failed: audit rows';
  end if;
end
$verify$;

commit;

