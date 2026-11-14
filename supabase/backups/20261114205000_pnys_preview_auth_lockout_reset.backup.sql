-- Read-only backup evidence before the PNYS Preview authentication-lock reset audit.
select
  store_code,
  version,
  updated_at,
  jsonb_array_length(coalesce(doc->'sessions', '[]'::jsonb)) as staff_session_count,
  jsonb_array_length(coalesce(doc->'admin_sessions', '[]'::jsonb)) as manager_session_count,
  coalesce(doc->'audit', '[]'::jsonb) @> '[{"ref_id":"PNYS-AUTH-LOCKOUT-RESET-20261114"}]'::jsonb as reset_already_audited
from pnys_pos.live_state
where store_code = 'PNYS';

