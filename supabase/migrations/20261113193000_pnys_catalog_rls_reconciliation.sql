-- PNYS Release 1 correction only. Never reads from or writes to pny_pos.
begin;

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'pnys_app') then
    create role pnys_app nologin nobypassrls;
  end if;
  alter role pnys_app nologin nobypassrls;
  execute format('grant pnys_app to %I', current_user);
end $role$;

alter table pnys_pos.clone_audit
  add column if not exists audit_kind text not null default 'foundation_clone',
  add column if not exists detail jsonb not null default '{}'::jsonb;

revoke all on schema pnys_pos from public;
revoke all on schema pos_hub from public;
revoke all on all tables in schema pnys_pos from public;
revoke all on all tables in schema pos_hub from public;
revoke all on all sequences in schema pnys_pos from public;
revoke all on all sequences in schema pos_hub from public;

do $revoke_roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema pnys_pos from %I', role_name);
      execute format('revoke all on schema pos_hub from %I', role_name);
      execute format('revoke all on all tables in schema pnys_pos from %I', role_name);
      execute format('revoke all on all tables in schema pos_hub from %I', role_name);
      execute format('revoke all on all sequences in schema pnys_pos from %I', role_name);
      execute format('revoke all on all sequences in schema pos_hub from %I', role_name);
    end if;
  end loop;
end $revoke_roles$;

grant usage on schema pnys_pos to pnys_app;
grant usage on schema pos_hub to pnys_app;
grant select, insert, update, delete on all tables in schema pnys_pos to pnys_app;
grant select, insert, update, delete on all tables in schema pos_hub to pnys_app;
revoke insert, update, delete on pnys_pos.clone_audit from pnys_app;
grant usage, select on all sequences in schema pnys_pos to pnys_app;
grant usage, select on all sequences in schema pos_hub to pnys_app;

alter default privileges in schema pnys_pos revoke all on tables from public;
alter default privileges in schema pos_hub revoke all on tables from public;
alter default privileges in schema pnys_pos grant select, insert, update, delete on tables to pnys_app;
alter default privileges in schema pos_hub grant select, insert, update, delete on tables to pnys_app;
alter default privileges in schema pnys_pos revoke all on sequences from public;
alter default privileges in schema pos_hub revoke all on sequences from public;
alter default privileges in schema pnys_pos grant usage, select on sequences to pnys_app;
alter default privileges in schema pos_hub grant usage, select on sequences to pnys_app;

do $rls$
declare row record;
begin
  for row in
    select schemaname, tablename
    from pg_tables
    where schemaname in ('pnys_pos', 'pos_hub')
    order by schemaname, tablename
  loop
    execute format('alter table %I.%I enable row level security', row.schemaname, row.tablename);
    execute format('alter table %I.%I force row level security', row.schemaname, row.tablename);
    execute format('drop policy if exists pnys_app_all on %I.%I', row.schemaname, row.tablename);
    execute format(
      'create policy pnys_app_all on %I.%I for all to pnys_app using (true) with check (true)',
      row.schemaname,
      row.tablename
    );
  end loop;
end $rls$;

commit;
