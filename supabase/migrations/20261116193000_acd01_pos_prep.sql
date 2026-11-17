-- ACD01 foundation only. PNY01/pny_pos is never read or written.
-- ACD01 starts FROZEN. Kitchen may queue pending refill batches, but stock,
-- sales, shifts, receipts and integrations cannot change until activation.
begin;

alter table pnys_pos.live_state drop constraint if exists live_state_store_code_check;
alter table pnys_pos.live_state add constraint live_state_store_code_check check (store_code in ('PNYS','ACD01'));
alter table pnys_pos.shift drop constraint if exists shift_store_code_check;
alter table pnys_pos.shift add constraint shift_store_code_check check (store_code in ('PNYS','ACD01'));
alter table pnys_pos.sale drop constraint if exists sale_store_code_check;
alter table pnys_pos.sale add constraint sale_store_code_check check (store_code in ('PNYS','ACD01'));
alter table pnys_pos.deposit drop constraint if exists deposit_store_code_check;
alter table pnys_pos.deposit add constraint deposit_store_code_check check (store_code in ('PNYS','ACD01'));
alter table pnys_pos.stock_count drop constraint if exists stock_count_store_code_check;
alter table pnys_pos.stock_count add constraint stock_count_store_code_check check (store_code in ('PNYS','ACD01'));
alter table pnys_pos.refill drop constraint if exists refill_store_code_check;
alter table pnys_pos.refill add constraint refill_store_code_check check (store_code in ('PNYS','ACD01'));
alter table pnys_pos.closing drop constraint if exists closing_store_code_check;
alter table pnys_pos.closing add constraint closing_store_code_check check (store_code in ('PNYS','ACD01'));

insert into pos_hub.store(store_code,display_name,active,test_store)
values ('ACD01','Amesbury Cannabis Dispensary',true,true)
on conflict (store_code) do update set display_name=excluded.display_name,active=true,test_store=true,updated_at=now();

insert into pos_hub.store_policy(store_code,opening_count_required,closing_count_required,updated_by,updated_at)
values ('ACD01',true,true,'Codex for Tri',now())
on conflict (store_code) do update set opening_count_required=true,closing_count_required=true,updated_by='Codex for Tri',updated_at=now();

insert into pos_hub.store_runtime(store_code,write_mode,generation,cutover_id,changed_at,changed_by)
values ('ACD01','FROZEN',2,'ACD01-PREP',now(),'Codex for Tri')
on conflict (store_code) do update set write_mode='FROZEN',generation=2,cutover_id='ACD01-PREP',changed_at=now(),changed_by='Codex for Tri';

create or replace function pos_hub.guard_pnys_live_state_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, pos_hub
as $guard$
declare
  target_store text := coalesce(new.store_code, old.store_code);
  mode text;
  expected_generation bigint;
  session_store text := current_setting('app.store_code', true);
  session_generation bigint := nullif(current_setting('app.generation', true), '')::bigint;
  mutation_kind text := current_setting('app.mutation_kind', true);
  preview_test boolean := coalesce(nullif(current_setting('app.preview_test', true), '')::boolean, false);
  frozen_allowed boolean;
begin
  if target_store not in ('PNYS','ACD01') then raise exception using errcode='P0001',message='PNYS_STORE_GUARD'; end if;
  select write_mode,generation into mode,expected_generation from pos_hub.store_runtime where store_code=target_store;
  frozen_allowed := (target_store='PNYS' and mode='FROZEN' and mutation_kind in ('AUTH_SESSION','CLOSE_REDO','STOCK_REQUEST') and preview_test)
                 or (target_store='ACD01' and mode='FROZEN' and mutation_kind='KITCHEN_REFILL');
  if mode is distinct from 'ACTIVE' and not frozen_allowed then raise exception using errcode='P0001',message='PNYS_WRITE_FROZEN'; end if;
  if session_store is distinct from target_store or session_generation is distinct from expected_generation then raise exception using errcode='P0001',message='PNYS_STALE_DEPLOYMENT'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$guard$;

drop policy if exists pnys_app_read_store_runtime on pos_hub.store_runtime;
create policy pnys_app_read_store_runtime on pos_hub.store_runtime
  for select to pnys_app using (store_code in ('PNYS','ACD01'));

select set_config('app.store_code','ACD01',true),
       set_config('app.generation','2',true),
       set_config('app.mutation_kind','KITCHEN_REFILL',true),
       set_config('app.preview_test','false',true);

with source as (
  select doc from pnys_pos.live_state where store_code='PNYS'
), prepared as (
  select (doc
    || jsonb_build_object(
      'stores', jsonb_build_array(jsonb_build_object(
        'code','ACD01','name','Amesbury Cannabis Dispensary','active',true,
        'timezone','America/Toronto','prices_tax_included',true,'weed_in_store',true,
        'opening_count_required',true,'closing_count_required',true,'ticket_letter_seq',0,'created_at',now()
      )),
      'store_products', coalesce((select jsonb_agg(jsonb_set(jsonb_set(row,'{store_code}','"ACD01"'::jsonb),'{enabled}','false'::jsonb) order by row->>'sku') from jsonb_array_elements(coalesce(doc->'store_products','[]'::jsonb)) row), '[]'::jsonb),
      'balances','[]'::jsonb,'staff','[]'::jsonb,'shifts','[]'::jsonb,'sessions','[]'::jsonb,
      'incoming','[]'::jsonb,'refill_receipts','[]'::jsonb,'stock_requests','[]'::jsonb,
      'counts','[]'::jsonb,'count_lines','[]'::jsonb,'tickets','[]'::jsonb,'ticket_lines','[]'::jsonb,
      'sales','[]'::jsonb,'sale_lines','[]'::jsonb,'deposits','[]'::jsonb,'closings','[]'::jsonb,
      'closing_versions','[]'::jsonb,'closing_drafts','[]'::jsonb,'ledger','[]'::jsonb,
      'idempotency','[]'::jsonb,'outbox','[]'::jsonb,'cursors','[]'::jsonb,'audit','[]'::jsonb,
      'admin_sessions','[]'::jsonb,'customers','[]'::jsonb,'customer_consents','[]'::jsonb,
      'customer_visits','[]'::jsonb,'coupons','[]'::jsonb,'coupon_redemptions','[]'::jsonb,'deposit_seq',0
    ) - 'opening_stock_at' - 'stock_labels') as doc
  from source
)
insert into pnys_pos.live_state(store_code,version,doc,updated_at)
select 'ACD01',0,doc,now() from prepared
on conflict (store_code) do nothing;

insert into pos_hub.policy_audit(id,store_code,policy_key,old_value,new_value,changed_by,changed_at)
values (md5('ACD01-PREP-20261116')::uuid,'ACD01','store.prepared',null,
        '{"write_mode":"FROZEN","opening_count_required":true,"closing_count_required":true,"integrations":"DISABLED","stock_units":0}'::jsonb,
        'Codex for Tri',now())
on conflict (id) do nothing;

do $verify$
begin
  if (select count(*) from pnys_pos.live_state where store_code='ACD01') <> 1 then raise exception 'ACD01 state missing'; end if;
  if (select write_mode from pos_hub.store_runtime where store_code='ACD01') <> 'FROZEN' then raise exception 'ACD01 must remain FROZEN'; end if;
  if (select jsonb_array_length(doc->'balances') from pnys_pos.live_state where store_code='ACD01') <> 0 then raise exception 'ACD01 must start with zero stock'; end if;
  if (select jsonb_array_length(doc->'products') from pnys_pos.live_state where store_code='ACD01') = 0 then raise exception 'ACD01 catalog missing'; end if;
  if exists(select 1 from pos_hub.integration_owner where owner_store_code='ACD01') then raise exception 'ACD01 must not own integrations'; end if;
end
$verify$;

commit;
