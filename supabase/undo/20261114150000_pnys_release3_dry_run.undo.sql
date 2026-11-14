-- Guarded cleanup for PNYS Release 3 test records only.
-- The approved dry run uses MemoryDb and persists no rows, so this is normally a no-op.
-- Never reads or writes pny_pos.
begin;

delete from pos_hub.coupon_redemption where sale_id like 'RELEASE3-%';
delete from pos_hub.customer_visit where sale_id like 'RELEASE3-%';
delete from pos_hub.customer_consent where source = 'IN_STORE_DRY_RUN';
delete from pos_hub.coupon where code = 'DRY10' and created_by = 'RELEASE3-DRY-RUN';
delete from pos_hub.customer where email = 'dry-run@example.invalid';

delete from pnys_pos.sale where id like 'RELEASE3-%';
delete from pnys_pos.refill where kitchen_row_id like 'RELEASE3-%';
delete from pnys_pos.stock_count where id like 'RELEASE3-%';
delete from pnys_pos.closing where shift_id like 'RELEASE3-%';
delete from pnys_pos.shift where id like 'RELEASE3-%';

commit;
