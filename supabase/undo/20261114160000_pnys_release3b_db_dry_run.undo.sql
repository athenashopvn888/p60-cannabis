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
set doc = backup.old_value,
    version = (backup.new_value->>'version')::bigint,
    updated_at = (backup.new_value->>'updated_at')::timestamptz
from pos_hub.policy_audit backup
where state.store_code = 'PNYS'
  and backup.id = 'd3b00000-0000-4000-8000-000000000001'::uuid
  and backup.policy_key = 'DRY_R3B_BACKUP';

delete from pos_hub.policy_audit
where id = 'd3b00000-0000-4000-8000-000000000001'::uuid
  and policy_key = 'DRY_R3B_BACKUP';

commit;
