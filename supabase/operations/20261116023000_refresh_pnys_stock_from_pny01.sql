-- One-time PNYS preview stock refresh requested by Tri.
-- Reads pny_pos.PNY01. Writes only pnys_pos and pos_hub. PNYS must remain FROZEN.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $refresh$
declare
  source_doc jsonb;
  target_doc jsonb;
  source_balances jsonb;
  next_doc jsonb;
  source_version bigint;
  target_version bigint;
  target_generation bigint;
  source_updated_at timestamptz;
  balance_count integer;
  unit_count integer;
  missing_count integer;
  balance_checksum text;
  changed integer;
begin
  if (select write_mode from pos_hub.store_runtime where store_code = 'PNYS') <> 'FROZEN' then
    raise exception 'PNYS must be FROZEN before stock refresh';
  end if;
  select generation into target_generation from pos_hub.store_runtime where store_code = 'PNYS';
  perform set_config('app.store_code', 'PNYS', true);
  perform set_config('app.generation', target_generation::text, true);
  perform set_config('app.mutation_kind', 'STOCK_REFRESH', true);
  perform set_config('app.preview_test', 'true', true);

  select version, updated_at, doc
    into source_version, source_updated_at, source_doc
  from pny_pos.live_state
  where store_code = 'PNY01';
  if source_doc is null then raise exception 'PNY01 source state is missing'; end if;

  select version, doc
    into target_version, target_doc
  from pnys_pos.live_state
  where store_code = 'PNYS'
  for update;
  if target_doc is null then raise exception 'PNYS target state is missing'; end if;

  select coalesce(jsonb_agg(jsonb_set(balance, '{store_code}', '"PNYS"'::jsonb) order by balance->>'sku'), '[]'::jsonb)
    into source_balances
  from jsonb_array_elements(coalesce(source_doc->'balances', '[]'::jsonb)) balance
  where coalesce(balance->>'store_code', 'PNY01') = 'PNY01';

  select count(*)::integer, coalesce(sum((balance->>'qty')::integer), 0)::integer
    into balance_count, unit_count
  from jsonb_array_elements(source_balances) balance;
  if balance_count = 0 then raise exception 'PNY01 source returned zero balances'; end if;

  select count(*)::integer
    into missing_count
  from jsonb_array_elements(source_balances) balance
  where not exists (select 1 from jsonb_array_elements(coalesce(target_doc->'products', '[]'::jsonb)) product where product->>'sku' = balance->>'sku')
     or not exists (select 1 from jsonb_array_elements(coalesce(target_doc->'store_products', '[]'::jsonb)) store_product where store_product->>'store_code' = 'PNYS' and store_product->>'sku' = balance->>'sku');
  if missing_count <> 0 then raise exception 'PNYS catalog is missing % PNY01 balance SKUs', missing_count; end if;

  balance_checksum := encode(digest(source_balances::text, 'sha256'), 'hex');
  next_doc := jsonb_set(target_doc, '{balances}', source_balances, true);

  insert into pos_hub.policy_audit(id, store_code, policy_key, old_value, new_value, changed_by)
  values (
    'd82bdc1b-bc39-46d0-8f45-3edab297a47c'::uuid,
    'PNYS',
    'PNYS_STOCK_REFRESH_BACKUP_20261116',
    target_doc,
    jsonb_build_object(
      'target_version_before', target_version,
      'target_version_after', target_version + 1,
      'source_version', source_version,
      'source_updated_at', source_updated_at,
      'balance_rows', balance_count,
      'on_hand_units', unit_count,
      'balance_checksum', balance_checksum,
      'clone_audit_id', 'c33ae764-9822-4289-8896-31ae561650bb'
    ),
    'Codex for Tri'
  );

  -- This mode change is visible only inside this transaction. It is restored
  -- before commit, so no app session can observe or trade on an ACTIVE PNYS.
  update pos_hub.store_runtime set write_mode = 'ACTIVE' where store_code = 'PNYS';
  update pnys_pos.live_state
  set doc = next_doc, version = version + 1, updated_at = now()
  where store_code = 'PNYS' and version = target_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PNYS stock refresh version guard failed'; end if;
  update pos_hub.store_runtime set write_mode = 'FROZEN' where store_code = 'PNYS';

  insert into pnys_pos.clone_audit(
    clone_id, source_store, target_store, source_version,
    source_counts, target_counts, source_checksum, target_checksum,
    reconciled, audit_kind, detail
  ) values (
    'c33ae764-9822-4289-8896-31ae561650bb'::uuid,
    'PNY01', 'PNYS', source_version,
    jsonb_build_object('balance_rows', balance_count, 'on_hand_units', unit_count),
    jsonb_build_object('balance_rows', balance_count, 'on_hand_units', unit_count),
    balance_checksum, balance_checksum, true, 'stock_refresh',
    jsonb_build_object('actor', 'Codex for Tri', 'source_updated_at', source_updated_at, 'backup_id', 'd82bdc1b-bc39-46d0-8f45-3edab297a47c')
  );
end
$refresh$;

commit;

with state as (
  select version, updated_at, doc
  from pnys_pos.live_state
  where store_code = 'PNYS'
), balances as (
  select balance
  from state, jsonb_array_elements(coalesce(doc->'balances', '[]'::jsonb)) balance
  where balance->>'store_code' = 'PNYS'
), products as (
  select product
  from state, jsonb_array_elements(coalesce(doc->'products', '[]'::jsonb)) product
), store_products as (
  select store_product
  from state, jsonb_array_elements(coalesce(doc->'store_products', '[]'::jsonb)) store_product
  where store_product->>'store_code' = 'PNYS'
)
select
  (select version from state) as pnys_version,
  (select updated_at from state) as refreshed_at,
  count(*)::integer as balance_rows,
  coalesce(sum((balance->>'qty')::integer), 0)::integer as on_hand_units,
  round(coalesce(sum(
    (balance->>'qty')::numeric * coalesce(
      nullif(store_product->>'price_override_cents', '')::numeric,
      nullif(product->>'default_price_cents', '')::numeric,
      0
    )
  ), 0) / 100, 2) as stock_value_dollars,
  encode(digest(jsonb_agg(balance order by balance->>'sku')::text, 'sha256'), 'hex') as balance_checksum
from balances
left join products on product->>'sku' = balance->>'sku'
left join store_products on store_product->>'sku' = balance->>'sku';
