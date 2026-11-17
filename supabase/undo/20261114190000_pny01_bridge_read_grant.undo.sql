-- Restore the verified pre-state: pny01_till had no pos_hub privileges.
begin;

revoke select on pos_hub.store_runtime, pos_hub.integration_owner from pny01_till;
revoke usage on schema pos_hub from pny01_till;

do $verify$
begin
  if has_schema_privilege('pny01_till', 'pos_hub', 'USAGE')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'SELECT')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'INSERT')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'UPDATE')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'DELETE')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'SELECT')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'INSERT')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'UPDATE')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'DELETE') then
    raise exception 'Undo verification failed: pny01_till still has pos_hub privileges';
  end if;
end
$verify$;

commit;
