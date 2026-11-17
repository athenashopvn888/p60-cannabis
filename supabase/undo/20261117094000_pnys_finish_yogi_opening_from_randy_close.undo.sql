-- Surgical rollback: restore only Yogi's prior opening-count draft, preserving later sales, balances and refills.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $undo$
declare
  expected_shift constant uuid := 'dd6e9c49-3fc2-46a0-b9a2-f02f4453b6ce'::uuid;
  backup_id constant uuid := 'be2d6cc7-d4fa-488f-8ba7-af32beeb4cdb'::uuid;
  backup_doc jsonb;
  old_draft jsonb;
  current_doc jsonb;
  next_doc jsonb;
  current_version bigint;
  target_generation bigint;
  at timestamptz := now();
  changed integer;
begin
  select old_value into backup_doc
  from pos_hub.policy_audit
  where id = backup_id and store_code = 'PNYS'
    and policy_key = 'PNYS_YOGI_OPENING_AUTO_COMPLETE_BACKUP_20261117';
  if backup_doc is null then raise exception 'Yogi opening backup is missing'; end if;
  select row into old_draft from jsonb_array_elements(backup_doc->'closing_drafts') row where row->>'shift_id' = expected_shift::text;
  if old_draft is null then raise exception 'Prior Yogi draft is missing'; end if;

  select generation into target_generation from pos_hub.store_runtime where store_code = 'PNYS' and write_mode = 'ACTIVE';
  if target_generation is null then raise exception 'PNYS is not ACTIVE'; end if;
  perform set_config('app.store_code', 'PNYS', true);
  perform set_config('app.generation', target_generation::text, true);
  perform set_config('app.mutation_kind', 'OPERATIONAL', true);

  select version, doc into current_version, current_doc from pnys_pos.live_state where store_code = 'PNYS' for update;
  if not exists (
    select 1 from jsonb_array_elements(current_doc->'shifts') row
    where row->>'id' = expected_shift::text and row->>'status' = 'ACTIVE'
  ) then raise exception 'Yogi shift is no longer active; surgical rollback refused'; end if;

  next_doc := jsonb_set(
    current_doc,
    '{closing_drafts}',
    (select jsonb_agg(case when row->>'shift_id' = expected_shift::text then old_draft else row end order by ord)
     from jsonb_array_elements(current_doc->'closing_drafts') with ordinality draft(row, ord)),
    true
  );
  next_doc := jsonb_set(next_doc, '{audit}', coalesce(next_doc->'audit','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(), 'action', 'OPENING_COUNT_AUTO_COMPLETE_UNDONE', 'ref_type', 'shift', 'ref_id', expected_shift,
    'actor', 'Codex for Tri', 'detail', jsonb_build_object('backup_id', backup_id), 'created_at', at
  )), true);

  update pnys_pos.live_state set doc = next_doc, version = version + 1, updated_at = at
  where store_code = 'PNYS' and version = current_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS rollback version guard failed'; end if;
end
$undo$;

commit;
