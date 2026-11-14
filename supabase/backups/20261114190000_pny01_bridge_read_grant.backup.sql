-- Read-only backup of the PNY01 app role's effective permissions before the bridge grant.
select 'SCHEMA' as object_type, 'pos_hub' as object_name, privilege_type
from information_schema.usage_privileges
where grantee = 'pny01_till'
  and object_type = 'SCHEMA'
  and object_name = 'pos_hub'
union all
select 'TABLE', table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'pny01_till'
  and table_schema = 'pos_hub'
order by 1, 2, 3;

select
  has_schema_privilege('pny01_till', 'pos_hub', 'USAGE') as schema_usage,
  has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'SELECT') as runtime_select,
  has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'INSERT') as runtime_insert,
  has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'UPDATE') as runtime_update,
  has_table_privilege('pny01_till', 'pos_hub.store_runtime', 'DELETE') as runtime_delete,
  has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'SELECT') as owner_select,
  has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'INSERT') as owner_insert,
  has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'UPDATE') as owner_update,
  has_table_privilege('pny01_till', 'pos_hub.integration_owner', 'DELETE') as owner_delete;
