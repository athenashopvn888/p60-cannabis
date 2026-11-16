-- Add Tri-approved Pink Phoenix catalog entries to the live PNYS store.
-- Scope: pnys_pos.PNYS and pos_hub.policy_audit only. Stock starts at zero.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $add_catalog$
declare
  backup_id constant uuid := '5966163d-410a-4066-921b-450639b904b0'::uuid;
  audit_id constant uuid := '6fb77088-48aa-4e0f-b1f9-f09a9de3b9bb'::uuid;
  current_doc jsonb;
  next_doc jsonb;
  current_version bigint;
  target_generation bigint;
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
  -- Catalog-only append. The row lock serializes this with any active-shift
  -- mutation, while the version guard prevents a stale whole-document write.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(current_doc->'products', '[]'::jsonb)) row
    where row->>'sku' in ('512-3g', '512-5g')
  ) then raise exception 'Pink Phoenix catalog rows already exist'; end if;

  insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
  values (
    backup_id,
    'PNYS',
    'PNYS_CATALOG_512_BACKUP_20261117',
    current_doc,
    jsonb_build_object(
      'target_version_before', current_version,
      'target_version_after', current_version + 1,
      'skus', jsonb_build_array('512-3g', '512-5g'),
      'stock_units_added', 0
    ),
    'Codex for Tri'
  );

  next_doc := jsonb_set(
    current_doc,
    '{products}',
    coalesce(current_doc->'products', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'sku', '512-3g', 'name', 'PINK PHOENIX 3g', 'category', 'EXOTIC',
        'sku_sort', 512, 'thc_flag', true, 'image_url', null,
        'setb_active', true, 'default_price_cents', 4000,
        'created_at', at, 'synced_at', at
      ),
      jsonb_build_object(
        'sku', '512-5g', 'name', 'PINK PHOENIX 6g', 'category', 'EXOTIC',
        'sku_sort', 512, 'thc_flag', true, 'image_url', null,
        'setb_active', true, 'default_price_cents', 6000,
        'created_at', at, 'synced_at', at
      )
    ),
    true
  );
  next_doc := jsonb_set(
    next_doc,
    '{store_products}',
    coalesce(next_doc->'store_products', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'store_code', 'PNYS', 'sku', '512-3g', 'enabled', true,
        'price_override_cents', null, 'created_at', at, 'updated_at', at
      ),
      jsonb_build_object(
        'store_code', 'PNYS', 'sku', '512-5g', 'enabled', true,
        'price_override_cents', null, 'created_at', at, 'updated_at', at
      )
    ),
    true
  );
  next_doc := jsonb_set(
    next_doc,
    '{balances}',
    coalesce(next_doc->'balances', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('store_code', 'PNYS', 'sku', '512-3g', 'qty', 0, 'created_at', at, 'updated_at', at),
      jsonb_build_object('store_code', 'PNYS', 'sku', '512-5g', 'qty', 0, 'created_at', at, 'updated_at', at)
    ),
    true
  );
  next_doc := jsonb_set(
    next_doc,
    '{audit}',
    coalesce(next_doc->'audit', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', audit_id,
      'action', 'CATALOG_PRODUCTS_ADDED',
      'ref_type', 'catalog',
      'ref_id', '512',
      'actor', 'Codex for Tri',
      'detail', jsonb_build_object(
        'skus', jsonb_build_array('512-3g', '512-5g'),
        'prices_cents', jsonb_build_object('512-3g', 4000, '512-5g', 6000),
        'starting_qty', 0
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
$add_catalog$;

commit;

with state as (
  select version, doc from pnys_pos.live_state where store_code = 'PNYS'
)
select
  version,
  product->>'sku' as sku,
  product->>'name' as name,
  (product->>'default_price_cents')::integer as price_cents,
  (product->>'thc_flag')::boolean as thc_flag,
  (store_product->>'enabled')::boolean as enabled,
  (balance->>'qty')::integer as on_hand
from state
cross join lateral jsonb_array_elements(doc->'products') product
left join lateral (
  select row as store_product from jsonb_array_elements(doc->'store_products') row
  where row->>'store_code' = 'PNYS' and row->>'sku' = product->>'sku'
) store_row on true
left join lateral (
  select row as balance from jsonb_array_elements(doc->'balances') row
  where row->>'store_code' = 'PNYS' and row->>'sku' = product->>'sku'
) balance_row on true
where product->>'sku' in ('512-3g', '512-5g')
order by product->>'sku';
