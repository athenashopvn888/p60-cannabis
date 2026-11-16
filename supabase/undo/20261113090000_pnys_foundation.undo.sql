-- Destructive rollback for PNYS Release 1 only. Run manually after retaining the backup.
-- This removes only the two new Release 1 schemas.
begin;
drop schema if exists pnys_pos cascade;
drop schema if exists pos_hub cascade;
commit;
