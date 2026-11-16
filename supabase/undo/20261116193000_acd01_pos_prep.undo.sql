-- Use only before ACD01 receives real refill or shift data.
begin;
delete from pos_hub.policy_audit where id=md5('ACD01-PREP-20261116')::uuid;
delete from pnys_pos.live_state where store_code='ACD01';
delete from pos_hub.store_runtime where store_code='ACD01';
delete from pos_hub.store_policy where store_code='ACD01';
delete from pos_hub.store where store_code='ACD01';

alter table pnys_pos.live_state drop constraint if exists live_state_store_code_check;
alter table pnys_pos.live_state add constraint live_state_store_code_check check (store_code='PNYS');
alter table pnys_pos.shift drop constraint if exists shift_store_code_check;
alter table pnys_pos.shift add constraint shift_store_code_check check (store_code='PNYS');
alter table pnys_pos.sale drop constraint if exists sale_store_code_check;
alter table pnys_pos.sale add constraint sale_store_code_check check (store_code='PNYS');
alter table pnys_pos.deposit drop constraint if exists deposit_store_code_check;
alter table pnys_pos.deposit add constraint deposit_store_code_check check (store_code='PNYS');
alter table pnys_pos.stock_count drop constraint if exists stock_count_store_code_check;
alter table pnys_pos.stock_count add constraint stock_count_store_code_check check (store_code='PNYS');
alter table pnys_pos.refill drop constraint if exists refill_store_code_check;
alter table pnys_pos.refill add constraint refill_store_code_check check (store_code='PNYS');
alter table pnys_pos.closing drop constraint if exists closing_store_code_check;
alter table pnys_pos.closing add constraint closing_store_code_check check (store_code='PNYS');

drop policy if exists pnys_app_read_store_runtime on pos_hub.store_runtime;
create policy pnys_app_read_store_runtime on pos_hub.store_runtime for select to pnys_app using (store_code='PNYS');

create or replace function pos_hub.guard_pnys_live_state_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,pos_hub
as $guard$
declare target_store text:=coalesce(new.store_code,old.store_code); mode text; expected_generation bigint;
session_store text:=current_setting('app.store_code',true); session_generation bigint:=nullif(current_setting('app.generation',true),'')::bigint;
mutation_kind text:=current_setting('app.mutation_kind',true); preview_test boolean:=coalesce(nullif(current_setting('app.preview_test',true),'')::boolean,false); frozen_preview_allowed boolean;
begin
  if target_store<>'PNYS' then raise exception using errcode='P0001',message='PNYS_ONLY_GUARD'; end if;
  select write_mode,generation into mode,expected_generation from pos_hub.store_runtime where store_code=target_store;
  frozen_preview_allowed:=mode='FROZEN' and mutation_kind in ('AUTH_SESSION','CLOSE_REDO','STOCK_REQUEST') and preview_test;
  if mode is distinct from 'ACTIVE' and not frozen_preview_allowed then raise exception using errcode='P0001',message='PNYS_WRITE_FROZEN'; end if;
  if session_store is distinct from target_store or session_generation is distinct from expected_generation then raise exception using errcode='P0001',message='PNYS_STALE_DEPLOYMENT'; end if;
  if tg_op='DELETE' then return old; end if; return new;
end
$guard$;
commit;
