-- Read-only evidence captured immediately before ACD01 preparation.
select store_code, display_name, active, test_store from pos_hub.store where store_code in ('PNYS','ACD01') order by store_code;
select store_code, write_mode, generation, cutover_id from pos_hub.store_runtime where store_code in ('PNYS','ACD01') order by store_code;
select store_code, version, updated_at, jsonb_array_length(coalesce(doc->'products','[]'::jsonb)) product_count,
       jsonb_array_length(coalesce(doc->'balances','[]'::jsonb)) balance_count
from pnys_pos.live_state where store_code in ('PNYS','ACD01') order by store_code;
select conrelid::regclass::text table_name, conname, pg_get_constraintdef(oid) definition
from pg_constraint where conrelid::regclass::text like 'pnys_pos.%' and contype='c' order by 1,2;
select policyname, qual from pg_policies where schemaname='pos_hub' and tablename='store_runtime' order by policyname;
