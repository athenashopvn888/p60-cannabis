-- Undo PNYS Release 4 preparation only. Never reads or writes pny_pos.
-- Retain an export of integration_delivery before using this undo outside preview.
begin;

do $guard$
begin
  if exists (
    select 1 from pos_hub.integration_delivery
    where cutover_id <> 'PNYS-R4-PREP'
       or owner_store_code <> 'PNYS'
  ) then
    raise exception 'Release 4 prep undo refused: non-preview delivery evidence exists';
  end if;
end
$guard$;

drop trigger if exists pnys_live_state_write_guard on pnys_pos.live_state;
drop function if exists pos_hub.guard_pnys_live_state_write();
drop table if exists pos_hub.integration_delivery;
drop table if exists pos_hub.integration_owner;
drop table if exists pos_hub.store_runtime;

commit;
