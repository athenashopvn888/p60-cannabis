begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pnys_v2_app') then
    create role pnys_v2_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;

do $$
begin
  execute format('grant connect on database %I to pnys_v2_app', current_database());
end $$;
grant usage on schema pos_v2, pos_v2_hub to pnys_v2_app;
grant select on pos_v2_hub.system_identity to pnys_v2_app;
grant select, insert, update, delete on all tables in schema pos_v2 to pnys_v2_app;
grant select, insert, update, delete on
  pos_v2_hub.store_runtime,
  pos_v2_hub.integration_owner,
  pos_v2_hub.store_sequences
to pnys_v2_app;
grant usage, select on all sequences in schema pos_v2, pos_v2_hub to pnys_v2_app;

alter default privileges in schema pos_v2
  grant select, insert, update, delete on tables to pnys_v2_app;
alter default privileges in schema pos_v2
  grant usage, select on sequences to pnys_v2_app;

revoke all on all functions in schema pos_v2 from public;
grant execute on all functions in schema pos_v2 to pnys_v2_app;

commit;
