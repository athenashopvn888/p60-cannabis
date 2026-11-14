-- Remove only the two PNY01 bridge SELECT policies.
begin;

drop policy if exists pny01_till_read_store_runtime on pos_hub.store_runtime;
drop policy if exists pny01_till_read_integration_owner on pos_hub.integration_owner;

do $verify$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and policyname in (
        'pny01_till_read_store_runtime',
        'pny01_till_read_integration_owner'
      )
  ) then
    raise exception 'Undo verification failed: a PNY01 bridge policy remains';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'pos_hub'
        and tablename in ('store_runtime', 'integration_owner')
        and policyname in ('pnys_app_read_store_runtime', 'pnys_app_read_integration_owner')
        and cmd = 'SELECT'
        and roles = array['pnys_app']::name[]) <> 2 then
    raise exception 'Undo verification failed: existing pnys_app policies changed';
  end if;
end
$verify$;

commit;
