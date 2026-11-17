-- PNYS Preview only. The Manager/Kitchen lock counters are process-memory state;
-- the fresh deployment clears them. This guarded row records that reset without
-- changing PINs, staff, stock, sales, shifts, integrations or pny_pos.
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
    coalesce(doc->'audit', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'action', 'AUTH_LOCKOUT_RESET',
      'ref_type', 'preview_auth',
      'ref_id', 'PNYS-AUTH-LOCKOUT-RESET-20261114',
      'actor', 'Codex for Tri',
      'detail', jsonb_build_object(
        'store_code', 'PNYS',
        'scope', 'MANAGER_KITCHEN_PROCESS_MEMORY',
        'reason', 'Frozen preview authentication gate correction'
      ),
      'created_at', now()::text
    )),
    true
  ),
  version = version + 1,
  updated_at = now()
where store_code = 'PNYS'
  and not coalesce(doc->'audit', '[]'::jsonb) @> '[{"ref_id":"PNYS-AUTH-LOCKOUT-RESET-20261114"}]'::jsonb;

commit;

select
  store_code,
  version,
  updated_at,
  coalesce(doc->'audit', '[]'::jsonb) @> '[{"ref_id":"PNYS-AUTH-LOCKOUT-RESET-20261114","action":"AUTH_LOCKOUT_RESET","actor":"Codex for Tri"}]'::jsonb as reset_audited
from pnys_pos.live_state
where store_code = 'PNYS';

