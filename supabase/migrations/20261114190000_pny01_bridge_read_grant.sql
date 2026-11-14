-- PNY01 safety-bridge read grant only.
-- No pny_pos access changes and no pos_hub write permission.
begin;

do $guard$
begin
  if not exists (select 1 from pg_roles where rolname = 'pny01_till') then
    raise exception 'Grant refused: role pny01_till does not exist';
  end if;

  if has_schema_privilege('pny01_till', 'pos_hub', 'USAGE')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'SELECT')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'INSERT')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'UPDATE')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'DELETE')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'SELECT')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'INSERT')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'UPDATE')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'DELETE') then
    raise exception 'Grant refused: pny01_till effective pre-state changed';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'pny01_till' and table_schema = 'pos_hub'
  ) then
    raise exception 'Grant refused: pny01_till already has a pos_hub table grant';
  end if;
end
$guard$;

grant usage on schema pos_hub to pny01_till;
grant select on pos_hub.store_runtime, pos_hub.integration_owner to pny01_till;

do $verify$
begin
  if not has_schema_privilege('pny01_till', 'pos_hub', 'USAGE')
     or not has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'SELECT')
     or not has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'SELECT') then
    raise exception 'Grant verification failed: required read permission missing';
  end if;

  if has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'INSERT')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'UPDATE')
     or has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'DELETE')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'INSERT')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'UPDATE')
     or has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'DELETE') then
    raise exception 'Grant verification failed: write permission detected';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'pny01_till'
      and table_schema = 'pos_hub'
      and table_name not in ('store_runtime', 'integration_owner')
  ) then
    raise exception 'Grant verification failed: permission detected on another pos_hub table';
  end if;
end
$verify$;

commit;
