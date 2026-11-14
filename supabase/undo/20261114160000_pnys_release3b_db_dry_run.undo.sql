begin;

delete from pos_hub.coupon_redemption
where shift_id = 'DRY-R3B-SHIFT'
   or coupon_id in (select id from pos_hub.coupon where code = 'DRY-R3B-10')
   or customer_id in (select id from pos_hub.customer where email = 'dry-r3b@example.invalid');
delete from pos_hub.customer_visit
where shift_id = 'DRY-R3B-SHIFT'
   or customer_id in (select id from pos_hub.customer where email = 'dry-r3b@example.invalid');
delete from pos_hub.customer_consent
where source = 'DRY-R3B-IN_STORE'
   or customer_id in (select id from pos_hub.customer where email = 'dry-r3b@example.invalid');
delete from pos_hub.coupon where code = 'DRY-R3B-10';
delete from pos_hub.customer where email = 'dry-r3b@example.invalid';

delete from pnys_pos.sale where store_code = 'PNYS' and id like 'DRY-R3B-%';
delete from pnys_pos.refill where store_code = 'PNYS' and kitchen_row_id like 'DRY-R3B-%';
delete from pnys_pos.stock_count where store_code = 'PNYS' and id like 'DRY-R3B-%';
delete from pnys_pos.deposit where store_code = 'PNYS' and id like 'DRY-R3B-%';
delete from pnys_pos.closing where store_code = 'PNYS' and shift_id = 'DRY-R3B-SHIFT';
delete from pnys_pos.shift where store_code = 'PNYS' and id = 'DRY-R3B-SHIFT';

update pnys_pos.live_state state
set doc = backup.doc,
    version = backup.version,
    updated_at = backup.updated_at
from pnys_pos.release3b_backup backup
where state.store_code = 'PNYS'
  and backup.run_id = 'DRY-R3B-20261114';

drop table pnys_pos.release3b_backup;

commit;
