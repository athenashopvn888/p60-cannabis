-- Append Pink Phoenix to Tri's existing pending Randy refill batch.
-- Scope: pnys_pos.PNYS incoming rows and pos_hub.policy_audit only.
-- This does not change balances; stock changes only when Randy confirms receipt.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $append_refill$
declare
  target_batch constant text := '82176bf6-6e99-48c0-b894-6e660813d526';
  backup_id constant uuid := '88a1b501-4442-434c-b054-c897768d136a'::uuid;
  current_doc jsonb;
  next_doc jsonb;
  current_version bigint;
  target_generation bigint;
  batch_sent_at timestamptz;
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

  select min((row->>'kitchen_created_at')::timestamptz) into batch_sent_at
  from jsonb_array_elements(coalesce(current_doc->'incoming', '[]'::jsonb)) row
  where row->>'batch_id' = target_batch and row->>'status' = 'PENDING_CONFIRM';
  if batch_sent_at is null then raise exception 'Target refill batch is not pending'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(current_doc->'incoming', '[]'::jsonb)) row
    where row->>'batch_id' = target_batch and row->>'sku' in ('512-3g', '512-5g')
  ) then raise exception 'Pink Phoenix is already in the target refill batch'; end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(current_doc->'products', '[]'::jsonb)) row
    where row->>'sku' = '512-3g'
  ) or not exists (
    select 1 from jsonb_array_elements(coalesce(current_doc->'products', '[]'::jsonb)) row
    where row->>'sku' = '512-5g'
  ) then raise exception 'Pink Phoenix catalog rows are missing'; end if;

  insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
  values (
    backup_id,
    'PNYS',
    'PNYS_RANDY_REFILL_512_BACKUP_20261117',
    current_doc,
    jsonb_build_object(
      'target_version_before', current_version,
      'target_version_after', current_version + 1,
      'batch_id', target_batch,
      'lines', jsonb_build_array(
        jsonb_build_object('sku', '512-3g', 'qty_sent', 2),
        jsonb_build_object('sku', '512-5g', 'qty_sent', 2)
      ),
      'stock_units_added', 0
    ),
    'Codex for Tri'
  );

  next_doc := jsonb_set(
    current_doc,
    '{incoming}',
    coalesce(current_doc->'incoming', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'kitchen_row_id', '47b93984-14af-4012-8e63-05c0338f5b06',
        'batch_id', target_batch, 'store_code', 'PNYS', 'sku', '512-3g',
        'qty_sent', 2, 'kind', 'REFILL', 'kitchen_created_at', batch_sent_at,
        'imported_at', at, 'status', 'PENDING_CONFIRM', 'qty_received', null,
        'variance_reason', null, 'confirmed_shift_id', null, 'confirmed_at', null,
        'linked_ledger_id', null, 'sent_by', 'Kitchen', 'received_by', null,
        'approval_required', false, 'created_at', at
      ),
      jsonb_build_object(
        'kitchen_row_id', 'f17db5f8-3ffe-43ae-83ad-b76befbbcfb2',
        'batch_id', target_batch, 'store_code', 'PNYS', 'sku', '512-5g',
        'qty_sent', 2, 'kind', 'REFILL', 'kitchen_created_at', batch_sent_at,
        'imported_at', at, 'status', 'PENDING_CONFIRM', 'qty_received', null,
        'variance_reason', null, 'confirmed_shift_id', null, 'confirmed_at', null,
        'linked_ledger_id', null, 'sent_by', 'Kitchen', 'received_by', null,
        'approval_required', false, 'created_at', at
      )
    ),
    true
  );
  next_doc := jsonb_set(
    next_doc,
    '{audit}',
    coalesce(next_doc->'audit', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'action', 'REFILL_BATCH_LINES_APPENDED',
      'ref_type', 'refill_batch', 'ref_id', target_batch, 'actor', 'Codex for Tri',
      'detail', jsonb_build_object(
        'lines', jsonb_build_array(
          jsonb_build_object('sku', '512-3g', 'qty_sent', 2),
          jsonb_build_object('sku', '512-5g', 'qty_sent', 2)
        ),
        'stock_units_added', 0
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
$append_refill$;

commit;

select
  version,
  row->>'batch_id' as batch_id,
  row->>'sku' as sku,
  (row->>'qty_sent')::integer as qty_sent,
  row->>'status' as status,
  (select (balance->>'qty')::integer from jsonb_array_elements(doc->'balances') balance where balance->>'store_code' = 'PNYS' and balance->>'sku' = row->>'sku') as on_hand
from pnys_pos.live_state
cross join lateral jsonb_array_elements(doc->'incoming') row
where store_code = 'PNYS'
  and row->>'batch_id' = '82176bf6-6e99-48c0-b894-6e660813d526'
  and row->>'sku' in ('512-3g', '512-5g')
order by row->>'sku';
