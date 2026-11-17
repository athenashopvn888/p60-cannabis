-- Removes only the audit marker added by 20261114205000. It does not change
-- PINs, staff, stock, sales, shifts, integrations or pny_pos.
begin;

select
  set_config('app.store_code', 'PNYS', true),
  set_config('app.generation', generation::text, true),
  set_config('app.mutation_kind', 'AUTH_SESSION', true),
  set_config('app.preview_test', 'true', true)
from pos_hub.store_runtime
where store_code = 'PNYS';

select version
from pnys_pos.live_state
where store_code = 'PNYS'
for update;

update pnys_pos.live_state
set
  doc = jsonb_set(
    doc,
    '{audit}',
    coalesce((
      select jsonb_agg(row)
      from jsonb_array_elements(coalesce(doc->'audit', '[]'::jsonb)) row
      where row->>'ref_id' <> 'PNYS-AUTH-LOCKOUT-RESET-20261114'
    ), '[]'::jsonb),
    true
  ),
  version = version + 1,
  updated_at = now()
where store_code = 'PNYS'
  and coalesce(doc->'audit', '[]'::jsonb) @> '[{"ref_id":"PNYS-AUTH-LOCKOUT-RESET-20261114"}]'::jsonb;

commit;

