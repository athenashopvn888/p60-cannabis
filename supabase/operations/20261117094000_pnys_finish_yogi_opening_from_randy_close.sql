-- Finish Yogi's accidental opening verification using Randy's final close less Yogi's completed sales.
-- Scope: PNYS live_state opening-count draft and audit only. Sales, balances, refills and closings are unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $finish_opening$
declare
  expected_shift constant uuid := 'dd6e9c49-3fc2-46a0-b9a2-f02f4453b6ce'::uuid;
  expected_staff constant text := 'sccx-staff-73';
  source_closing_shift constant uuid := '1bb78bc6-288b-4188-bf05-672ae56c5a75'::uuid;
  backup_id constant uuid := 'be2d6cc7-d4fa-488f-8ba7-af32beeb4cdb'::uuid;
  current_doc jsonb;
  next_doc jsonb;
  current_version bigint;
  target_generation bigint;
  active_shift jsonb;
  source_closing jsonb;
  derived_counts jsonb;
  at timestamptz := now();
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

  select row into active_shift
  from jsonb_array_elements(coalesce(current_doc->'shifts', '[]'::jsonb)) row
  where row->>'status' = 'ACTIVE';
  if active_shift is null
     or (active_shift->>'id')::uuid <> expected_shift
     or active_shift->>'staff_uid' <> expected_staff then
    raise exception 'Expected Yogi active shift is not current';
  end if;
  if coalesce((active_shift->>'opening_count_required')::boolean, false) then
    raise exception 'Active shift opening policy is not OFF';
  end if;
  if coalesce((select (row->>'opening_count_required')::boolean
               from jsonb_array_elements(coalesce(current_doc->'stores', '[]'::jsonb)) row
               where row->>'code' in ('PNYS', 'PNY01') limit 1), false) then
    raise exception 'Manager opening policy is not OFF';
  end if;

  select row into source_closing
  from jsonb_array_elements(coalesce(current_doc->'closings', '[]'::jsonb)) row
  where (row->>'shift_id')::uuid = source_closing_shift;
  if source_closing is null or jsonb_array_length(coalesce(source_closing->'closing_lines', '[]'::jsonb)) <> 128 then
    raise exception 'Randy source closing is missing or incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(current_doc->'incoming', '[]'::jsonb)) row
    where row->>'confirmed_shift_id' = expected_shift::text
  ) then
    raise exception 'Yogi has a confirmed refill; Randy-close-minus-sales is no longer sufficient';
  end if;

  with completed_sales as (
    select row->>'id' as sale_id
    from jsonb_array_elements(coalesce(current_doc->'sales', '[]'::jsonb)) row
    where row->>'shift_id' = expected_shift::text and row->>'status' = 'COMPLETED'
  ), sold as (
    select row->>'sku' as sku, sum((row->>'qty')::integer)::integer as qty
    from jsonb_array_elements(coalesce(current_doc->'sale_lines', '[]'::jsonb)) row
    where row->>'sale_id' in (select sale_id from completed_sales)
    group by row->>'sku'
  )
  select jsonb_agg(jsonb_build_object(
    'sku', line->>'sku',
    'counted_qty', greatest(0, (line->>'left')::integer - coalesce(sold.qty, 0)),
    'expected_qty', greatest(0, (line->>'left')::integer - coalesce(sold.qty, 0)),
    'submitted_at', at,
    'edited_at', at,
    'variance_reason', null,
    'added_stock', false,
    'accepted_as_is', true,
    'source', 'RANDY_CLOSE_LESS_YOGI_SALES'
  ) order by line->>'sku') into derived_counts
  from jsonb_array_elements(source_closing->'closing_lines') line
  left join sold on sold.sku = line->>'sku';

  if jsonb_array_length(derived_counts) <> 128 then raise exception 'Derived opening count is incomplete'; end if;
  if exists (
    select 1
    from jsonb_array_elements(derived_counts) count_row
    left join lateral (
      select row from jsonb_array_elements(coalesce(current_doc->'balances', '[]'::jsonb)) row
      where row->>'store_code' in ('PNYS', 'PNY01') and row->>'sku' = count_row->>'sku' limit 1
    ) balance on true
    where (count_row->>'counted_qty')::integer <> coalesce((balance.row->>'qty')::integer, 0)
  ) then raise exception 'Derived opening count does not match current balances'; end if;

  insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
  values (
    backup_id, 'PNYS', 'PNYS_YOGI_OPENING_AUTO_COMPLETE_BACKUP_20261117', current_doc,
    jsonb_build_object(
      'target_version_before', current_version,
      'target_version_after', current_version + 1,
      'shift_id', expected_shift,
      'source_closing_shift_id', source_closing_shift,
      'count_lines', jsonb_array_length(derived_counts),
      'balances_changed', 0,
      'sales_changed', 0,
      'opening_policy', 'OFF'
    ),
    'Codex for Tri'
  );

  next_doc := jsonb_set(
    current_doc,
    '{closing_drafts}',
    (select jsonb_agg(
      case when row->>'shift_id' = expected_shift::text
        then jsonb_set(
          jsonb_set(jsonb_set(row, '{opening_counts}', derived_counts, true), '{verify_submitted_at}', to_jsonb(at), true),
          '{updated_at}', to_jsonb(at), true
        )
        else row end
      order by ord
    ) from jsonb_array_elements(coalesce(current_doc->'closing_drafts', '[]'::jsonb)) with ordinality draft(row, ord)),
    true
  );
  if next_doc->'closing_drafts' is null then raise exception 'Yogi closing draft is missing'; end if;
  next_doc := jsonb_set(
    next_doc,
    '{audit}',
    coalesce(next_doc->'audit', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'action', 'OPENING_COUNT_AUTO_COMPLETED',
      'ref_type', 'shift',
      'ref_id', expected_shift,
      'actor', 'Codex for Tri',
      'detail', jsonb_build_object(
        'source', 'Randy final closing less Yogi completed sales',
        'source_closing_shift_id', source_closing_shift,
        'count_lines', 128,
        'opening_policy', 'OFF',
        'balances_changed', 0,
        'sales_changed', 0,
        'backup_id', backup_id
      ),
      'created_at', at
    )),
    true
  );

  update pnys_pos.live_state
  set doc = next_doc, version = version + 1, updated_at = at
  where store_code = 'PNYS' and version = current_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS version guard failed'; end if;
end
$finish_opening$;

commit;

select
  version,
  shift_row->>'sccx_shift_id' as shift_id,
  shift_row->>'opening_count_required' as opening_count_required,
  draft_row->>'verify_submitted_at' as verify_submitted_at,
  jsonb_array_length(draft_row->'opening_counts') as opening_count_lines
from pnys_pos.live_state
cross join lateral jsonb_array_elements(doc->'shifts') shift_row
cross join lateral jsonb_array_elements(doc->'closing_drafts') draft_row
where store_code = 'PNYS'
  and shift_row->>'id' = 'dd6e9c49-3fc2-46a0-b9a2-f02f4453b6ce'
  and draft_row->>'shift_id' = shift_row->>'id';
