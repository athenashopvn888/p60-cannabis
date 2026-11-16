-- Exact rollback for the 2026-11-16 PNYS stock refresh. Never writes pny_pos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $undo$
declare
  backup_doc jsonb;
  metadata jsonb;
  target_generation bigint;
  changed integer;
begin
  select old_value, new_value
    into backup_doc, metadata
  from pos_hub.policy_audit
  where id = 'd82bdc1b-bc39-46d0-8f45-3edab297a47c'::uuid
    and store_code = 'PNYS'
    and policy_key = 'PNYS_STOCK_REFRESH_BACKUP_20261116'
  for update;
  if backup_doc is null then raise exception 'PNYS stock refresh backup is missing'; end if;

  if (select write_mode from pos_hub.store_runtime where store_code = 'PNYS') <> 'FROZEN' then
    raise exception 'PNYS must be FROZEN before stock refresh rollback';
  end if;
  select generation into target_generation from pos_hub.store_runtime where store_code = 'PNYS';
  perform set_config('app.store_code', 'PNYS', true);
  perform set_config('app.generation', target_generation::text, true);
  perform set_config('app.mutation_kind', 'STOCK_REFRESH_UNDO', true);
  perform set_config('app.preview_test', 'true', true);

  update pos_hub.store_runtime set write_mode = 'ACTIVE' where store_code = 'PNYS';
  update pnys_pos.live_state
  set doc = backup_doc,
      version = (metadata->>'target_version_before')::bigint,
      updated_at = now()
  where store_code = 'PNYS'
    and version = (metadata->>'target_version_after')::bigint
    and encode(digest((doc->'balances')::text, 'sha256'), 'hex') = metadata->>'balance_checksum';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS stock refresh undo guard failed'; end if;
  update pos_hub.store_runtime set write_mode = 'FROZEN' where store_code = 'PNYS';

  delete from pnys_pos.clone_audit
  where clone_id = (metadata->>'clone_audit_id')::uuid
    and audit_kind = 'stock_refresh';
  delete from pos_hub.policy_audit
  where id = 'd82bdc1b-bc39-46d0-8f45-3edab297a47c'::uuid;
end
$undo$;

commit;
