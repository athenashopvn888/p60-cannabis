begin transaction read only;
set local statement_timeout = '5s';

select
  (select write_mode from pos_hub.store_runtime where store_code = 'PNY01') as pny01_write_mode,
  (select generation from pos_hub.store_runtime where store_code = 'PNY01') as pny01_generation,
  (select write_mode from pos_hub.store_runtime where store_code = 'PNYS') as pnys_write_mode,
  (select count(*) from pos_hub.integration_owner
    where owner_store_code = 'PNY01' and enabled = true) as pny01_owner_channels,
  (select count(distinct generation) from pos_hub.integration_owner) as owner_generations,
  (select min(generation) from pos_hub.integration_owner) as owner_generation,
  (select count(*) from pny_pos.live_state where store_code = 'PNY01') as pny01_live_state_rows,
  (select count(*) from pos_hub.policy_audit
    where changed_by = 'Codex for Tri'
      and (policy_key = 'store_runtime.write_mode' or policy_key like 'integration_owner.%')) as audit_rows;

rollback;
