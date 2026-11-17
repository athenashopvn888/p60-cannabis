-- Guarded rollback for 20261117001000_pnys_add_pink_phoenix.sql.
-- It refuses to run after any later PNYS write so no shift data can be lost.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $undo$
declare
  backup_id constant uuid := '5966163d-410a-4066-921b-450639b904b0'::uuid;
  backup_doc jsonb;
  backup_meta jsonb;
  current_version bigint;
  target_generation bigint;
  changed integer;
begin
  select old_value, new_value into backup_doc, backup_meta
  from pos_hub.policy_audit
  where id = backup_id and store_code = 'PNYS' and policy_key = 'PNYS_CATALOG_512_BACKUP_20261117';
  if backup_doc is null then raise exception 'Pink Phoenix backup is missing'; end if;

  select generation into target_generation
  from pos_hub.store_runtime
  where store_code = 'PNYS' and write_mode = 'ACTIVE';
  if target_generation is null then raise exception 'PNYS is not ACTIVE'; end if;
  perform set_config('app.store_code', 'PNYS', true);
  perform set_config('app.generation', target_generation::text, true);
  perform set_config('app.mutation_kind', 'OPERATIONAL', true);

  select version into current_version
  from pnys_pos.live_state
  where store_code = 'PNYS'
  for update;
  if current_version <> (backup_meta->>'target_version_after')::bigint then
    raise exception 'PNYS changed after catalog update; guarded rollback refused';
  end if;

  update pnys_pos.live_state
  set doc = backup_doc, version = version + 1, updated_at = now()
  where store_code = 'PNYS' and version = current_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS rollback version guard failed'; end if;

  insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
  values (
    gen_random_uuid(),
    'PNYS',
    'PNYS_CATALOG_512_UNDO_20261117',
    jsonb_build_object('version', current_version, 'skus', jsonb_build_array('512-3g', '512-5g')),
    jsonb_build_object('restored_backup_id', backup_id, 'restored_as_version', current_version + 1),
    'Codex for Tri'
  );
end
$undo$;

commit;
