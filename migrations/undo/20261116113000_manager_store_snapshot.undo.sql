begin;
revoke execute on function pos_hub.manager_store_snapshot(text) from pnys_app;
drop function if exists pos_hub.manager_store_snapshot(text);
commit;

