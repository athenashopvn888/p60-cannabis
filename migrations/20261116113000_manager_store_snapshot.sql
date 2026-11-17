-- Central Manager read model. This creates one curated, SELECT-only function
-- in pos_hub. It does not modify pny_pos or pnys_pos data or grants.
begin;

create or replace function pos_hub.manager_store_snapshot(p_store_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_store_code text := upper(trim(p_store_code));
  v_doc jsonb;
  v_safe_shifts jsonb;
begin
  if v_store_code = 'PNY01' then
    select doc into v_doc
    from pny_pos.live_state
    where store_code = 'PNY01';
  elsif v_store_code = 'PNYS' then
    select doc into v_doc
    from pnys_pos.live_state
    where store_code = 'PNYS';
  else
    raise exception 'Unsupported Manager store code';
  end if;

  if v_doc is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(value
      - 'pin_hash'
      - 'closing_access_pin_hash'
      - 'pin_failed_attempts'
      - 'pin_expires_at'
      - 'closing_access_expires_at'),
    '[]'::jsonb
  )
  into v_safe_shifts
  from jsonb_array_elements(coalesce(v_doc -> 'shifts', '[]'::jsonb));

  return jsonb_build_object(
    'stores', coalesce(v_doc -> 'stores', '[]'::jsonb),
    'products', coalesce(v_doc -> 'products', '[]'::jsonb),
    'store_products', coalesce(v_doc -> 'store_products', '[]'::jsonb),
    'balances', coalesce(v_doc -> 'balances', '[]'::jsonb),
    'staff', coalesce(v_doc -> 'staff', '[]'::jsonb),
    'shifts', v_safe_shifts,
    'incoming', coalesce(v_doc -> 'incoming', '[]'::jsonb),
    'refill_receipts', coalesce(v_doc -> 'refill_receipts', '[]'::jsonb),
    'sales', coalesce(v_doc -> 'sales', '[]'::jsonb),
    'closings', coalesce(v_doc -> 'closings', '[]'::jsonb),
    'closing_versions', coalesce(v_doc -> 'closing_versions', '[]'::jsonb),
    'audit', coalesce(v_doc -> 'audit', '[]'::jsonb)
  );
end;
$function$;

revoke all on function pos_hub.manager_store_snapshot(text) from public;
grant execute on function pos_hub.manager_store_snapshot(text) to pnys_app;

commit;

