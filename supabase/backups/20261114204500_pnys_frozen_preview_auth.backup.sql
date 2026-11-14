-- Read-only capture of the current PNYS live-state guard before replacement.
select pg_get_functiondef('pos_hub.guard_pnys_live_state_write()'::regprocedure);

