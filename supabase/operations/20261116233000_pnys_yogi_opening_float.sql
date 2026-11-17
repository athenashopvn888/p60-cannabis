-- Backfill the approved $44.00 opening cash on the first PNYS closing.
-- Scope: pnys_pos.PNYS only. Does not change stock, sales, deposits, counts, shifts, PINs, or pny_pos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $repair$
declare
  target_shift constant text := 'fce139ab-ca33-4476-8442-b0a2194c45c6';
  backup_id constant uuid := '57d94be1-e7b4-4d13-a91b-0839599d5e68'::uuid;
  current_doc jsonb;
  next_doc jsonb;
  current_version bigint;
  target_generation bigint;
  draft_row jsonb;
  closing_row jsonb;
  repaired_drafts jsonb;
  repaired_closings jsonb;
  changed integer;
begin
  select generation into target_generation
  from pos_hub.store_runtime
  where store_code = 'PNYS' and write_mode = 'ACTIVE';
  if target_generation is null then raise exception 'PNYS is not ACTIVE'; end if;

  perform set_config('app.store_code', 'PNYS', true);
  perform set_config('app.generation', target_generation::text, true);
  perform set_config('app.mutation_kind', 'OPERATIONAL', true);

  select version, doc into current_version, current_doc
  from pnys_pos.live_state
  where store_code = 'PNYS'
  for update;
  if current_doc is null then raise exception 'PNYS live state is missing'; end if;

  select row into draft_row
  from jsonb_array_elements(coalesce(current_doc->'closing_drafts', '[]'::jsonb)) row
  where row->>'shift_id' = target_shift;
  select row into closing_row
  from jsonb_array_elements(coalesce(current_doc->'closings', '[]'::jsonb)) row
  where row->>'shift_id' = target_shift;
  if draft_row is null or closing_row is null then raise exception 'Target PNYS closing is missing'; end if;
  if draft_row->>'float_found_cents' is not null
     or closing_row->>'opening_float_counted_cents' is not null
     or (closing_row->>'cash_sales_cents')::integer <> 25300
     or (closing_row->>'deposited_cents')::integer <> 32000
     or (closing_row->>'float_cents')::integer <> 2600
     or (closing_row->>'shortage_cents')::integer <> 3000
     or (closing_row->>'overage_cents')::integer <> 500 then
    raise exception 'Target closing no longer matches the reviewed backup';
  end if;

  insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
  values (
    backup_id,
    'PNYS',
    'PNYS_YOGI_OPENING_FLOAT_BACKUP_20261116',
    jsonb_build_object('version', current_version, 'draft', draft_row, 'closing', closing_row),
    jsonb_build_object(
      'shift_id', target_shift,
      'opening_float_cents', 4400,
      'expected_cash_cents', 32200,
      'cash_accounted_cents', 34600,
      'balance_cents', -2400
    ),
    'Codex for Tri'
  );

  select jsonb_agg(
    case when row->>'shift_id' = target_shift then
      row || jsonb_build_object(
        'float_expected_cents', 4400,
        'float_found_cents', 4400,
        'float_difference_cents', 0,
        'float_adjusted_by', null,
        'float_adjusted_at', null,
        'updated_at', now()
      )
    else row end
    order by ord
  ) into repaired_drafts
  from jsonb_array_elements(coalesce(current_doc->'closing_drafts', '[]'::jsonb)) with ordinality rows(row, ord);

  select jsonb_agg(
    case when row->>'shift_id' = target_shift then
      row || jsonb_build_object(
        'opening_float_expected_cents', 4400,
        'opening_float_counted_cents', 4400,
        'opening_float_difference_cents', 0,
        'opening_float_adjusted_by', null,
        'opening_float_adjusted_at', null,
        'balance_cents', -2400,
        'summary_text',
          replace(row->>'summary_text', 'Balance: -$42.00', 'Balance: -$24.00')
          || E'\nOpening cash: $44.00 · Previous close: $44.00 · Adjustment: $0.00'
      )
    else row end
    order by ord
  ) into repaired_closings
  from jsonb_array_elements(coalesce(current_doc->'closings', '[]'::jsonb)) with ordinality rows(row, ord);

  next_doc := jsonb_set(jsonb_set(current_doc, '{closing_drafts}', repaired_drafts, true), '{closings}', repaired_closings, true);
  next_doc := jsonb_set(next_doc, '{audit}', coalesce(next_doc->'audit', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', '57d94be1-e7b4-4d13-a91b-0839599d5e69',
    'action', 'OPENING_FLOAT_BACKFILLED',
    'ref_type', 'shift',
    'ref_id', target_shift,
    'actor', 'Codex for Tri',
    'detail', jsonb_build_object(
      'source', 'Randy closing carried into first PNYS shift',
      'opening_count_cents', 4400,
      'expected_cash_cents', 32200,
      'cash_accounted_cents', 34600,
      'balance_cents', -2400
    ),
    'created_at', now()
  )), true);

  update pnys_pos.live_state
  set doc = next_doc, version = version + 1, updated_at = now()
  where store_code = 'PNYS' and version = current_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS version guard failed'; end if;
end
$repair$;

commit;

select
  version,
  (select row from jsonb_array_elements(doc->'closing_drafts') row where row->>'shift_id' = 'fce139ab-ca33-4476-8442-b0a2194c45c6') as repaired_draft,
  (select row from jsonb_array_elements(doc->'closings') row where row->>'shift_id' = 'fce139ab-ca33-4476-8442-b0a2194c45c6') as repaired_closing
from pnys_pos.live_state
where store_code = 'PNYS';
