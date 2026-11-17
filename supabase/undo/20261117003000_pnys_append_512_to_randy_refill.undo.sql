-- Guarded rollback for 20261117003000_pnys_append_512_to_randy_refill.sql.
-- Refuses after any later PNYS write so active-shift data cannot be lost.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $undo$
declare
  backup_id constant uuid := '88a1b501-4442-434c-b054-c897768d136a'::uuid;
  backup_doc jsonb;
  backup_meta jsonb;
  current_version bigint;
  target_generation bigint;
  changed integer;
begin
  select old_value, new_value into backup_doc, backup_meta
  from pos_hub.policy_audit
  where id = backup_id and store_code = 'PNYS' and policy_key = 'PNYS_RANDY_REFILL_512_BACKUP_20261117';
  if backup_doc is null then raise exception 'Randy refill backup is missing'; end if;

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
    raise exception 'PNYS changed after refill edit; guarded rollback refused';
  end if;

  update pnys_pos.live_state
  set doc = backup_doc, version = version + 1, updated_at = now()
  where store_code = 'PNYS' and version = current_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS rollback version guard failed'; end if;
end
$undo$;

commit;
