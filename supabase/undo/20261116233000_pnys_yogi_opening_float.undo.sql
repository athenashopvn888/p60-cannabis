-- Targeted rollback for the PNYS Yogi opening-float repair.
-- Restores only the reviewed closing/draft and removes the repair audit row.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $undo$
declare
  target_shift constant text := 'fce139ab-ca33-4476-8442-b0a2194c45c6';
  backup_id constant uuid := '57d94be1-e7b4-4d13-a91b-0839599d5e68'::uuid;
  backup jsonb;
  current_doc jsonb;
  current_version bigint;
  target_generation bigint;
  reverted_drafts jsonb;
  reverted_closings jsonb;
  changed integer;
begin
  select old_value into backup
  from pos_hub.policy_audit
  where id = backup_id and store_code = 'PNYS' and policy_key = 'PNYS_YOGI_OPENING_FLOAT_BACKUP_20261116'
  for update;
  if backup is null then raise exception 'Opening-float backup is missing'; end if;

  select generation into target_generation
  from pos_hub.store_runtime
  where store_code = 'PNYS' and write_mode = 'ACTIVE';
  if target_generation is null then raise exception 'PNYS is not ACTIVE'; end if;
  perform set_config('app.store_code', 'PNYS', true);
  perform set_config('app.generation', target_generation::text, true);
  perform set_config('app.mutation_kind', 'OPERATIONAL', true);

  select version, doc into current_version, current_doc
  from pnys_pos.live_state where store_code = 'PNYS' for update;

  select jsonb_agg(case when row->>'shift_id' = target_shift then backup->'draft' else row end order by ord)
  into reverted_drafts
  from jsonb_array_elements(current_doc->'closing_drafts') with ordinality rows(row, ord);
  select jsonb_agg(case when row->>'shift_id' = target_shift then backup->'closing' else row end order by ord)
  into reverted_closings
  from jsonb_array_elements(current_doc->'closings') with ordinality rows(row, ord);

  current_doc := jsonb_set(jsonb_set(current_doc, '{closing_drafts}', reverted_drafts, true), '{closings}', reverted_closings, true);
  current_doc := jsonb_set(current_doc, '{audit}', coalesce((
    select jsonb_agg(row order by ord)
    from jsonb_array_elements(coalesce(current_doc->'audit', '[]'::jsonb)) with ordinality rows(row, ord)
    where row->>'id' <> '57d94be1-e7b4-4d13-a91b-0839599d5e69'
  ), '[]'::jsonb), true);

  update pnys_pos.live_state
  set doc = current_doc, version = version + 1, updated_at = now()
  where store_code = 'PNYS' and version = current_version
    and exists (
      select 1 from jsonb_array_elements(doc->'closings') row
      where row->>'shift_id' = target_shift
        and (row->>'opening_float_counted_cents')::integer = 4400
        and (row->>'balance_cents')::integer = -2400
    );
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Opening-float undo guard failed'; end if;

  delete from pos_hub.policy_audit where id = backup_id;
end
$undo$;

commit;
