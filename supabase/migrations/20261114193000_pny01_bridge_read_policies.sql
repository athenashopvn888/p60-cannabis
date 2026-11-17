-- PNY01 safety-bridge SELECT-only RLS policies.
-- Existing pnys_app policies are not changed.
begin;

do $guard$
begin
  if not exists (select 1 from pg_roles where rolname = 'pny01_till') then
    raise exception 'Policy change refused: role pny01_till does not exist';
  end if;

  if not has_schema_privilege('pny01_till', 'pos_hub', 'USAGE')
     or not has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'SELECT')
     or not has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'SELECT') then
    raise exception 'Policy change refused: approved read grants are missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and tablename in ('store_runtime', 'integration_owner')
      and 'pny01_till' = any(roles)
  ) then
    raise exception 'Policy change refused: a pny01_till control-table policy already exists';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and tablename = 'store_runtime'
      and policyname = 'pnys_app_read_store_runtime'
      and cmd = 'SELECT'
      and roles = array['pnys_app']::name[]
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and tablename = 'integration_owner'
      and policyname = 'pnys_app_read_integration_owner'
      and cmd = 'SELECT'
      and roles = array['pnys_app']::name[]
  ) then
    raise exception 'Policy change refused: existing pnys_app policies changed';
  end if;
end
$guard$;

create policy pny01_till_read_store_runtime
on pos_hub.store_runtime
for select
to pny01_till
using (store_code in ('PNY01', 'PNYS'));

create policy pny01_till_read_integration_owner
on pos_hub.integration_owner
for select
to pny01_till
using (true);

do $verify$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and tablename = 'store_runtime'
      and policyname = 'pny01_till_read_store_runtime'
      and cmd = 'SELECT'
      and roles = array['pny01_till']::name[]
      and qual = '(store_code = ANY (ARRAY[''PNY01''::text, ''PNYS''::text]))'
      and with_check is null
  ) then
    raise exception 'Policy verification failed: store_runtime policy';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and tablename = 'integration_owner'
      and policyname = 'pny01_till_read_integration_owner'
      and cmd = 'SELECT'
      and roles = array['pny01_till']::name[]
      and qual = 'true'
      and with_check is null
  ) then
    raise exception 'Policy verification failed: integration_owner policy';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'pos_hub'
      and 'pny01_till' = any(roles)
      and (
        tablename not in ('store_runtime', 'integration_owner')
        or cmd <> 'SELECT'
      )
  ) then
    raise exception 'Policy verification failed: pny01_till received broader policy access';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'pos_hub'
        and tablename in ('store_runtime', 'integration_owner')
        and policyname in ('pnys_app_read_store_runtime', 'pnys_app_read_integration_owner')
        and cmd = 'SELECT'
        and roles = array['pnys_app']::name[]) <> 2 then
    raise exception 'Policy verification failed: existing pnys_app policies changed';
  end if;
end
$verify$;

commit;
