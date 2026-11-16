-- Read-only backup captured immediately before applying the migration.
select pg_get_functiondef('pos_hub.guard_pnys_live_state_write()'::regprocedure);
