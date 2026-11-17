-- Structural rollback for the PNYS Release 1 RLS correction.
-- The generated runtime undo restores live_state and removes its audit row.
begin;

do $rls$
declare row record;
begin
  for row in
    select schemaname, tablename
    from pg_tables
    where schemaname in ('pnys_pos', 'pos_hub')
    order by schemaname, tablename
  loop
    execute format('drop policy if exists pnys_app_all on %I.%I', row.schemaname, row.tablename);
    execute format('alter table %I.%I no force row level security', row.schemaname, row.tablename);
    execute format('alter table %I.%I disable row level security', row.schemaname, row.tablename);
  end loop;
end $rls$;

revoke all on schema pnys_pos from pnys_app;
revoke all on schema pos_hub from pnys_app;
revoke all on all tables in schema pnys_pos from pnys_app;
revoke all on all tables in schema pos_hub from pnys_app;
revoke all on all sequences in schema pnys_pos from pnys_app;
revoke all on all sequences in schema pos_hub from pnys_app;

commit;
