-- Read-only backup of the two control-table RLS policies before adding PNY01 access.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'pos_hub'
  and tablename in ('store_runtime', 'integration_owner')
order by tablename, policyname;

select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'pos_hub'
  and c.relname in ('store_runtime', 'integration_owner')
order by c.relname;
