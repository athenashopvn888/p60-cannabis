-- PNYS Release 2g schema undo. Run only after retaining any customer data export.
-- Never reads or writes pny_pos.
begin;

drop index if exists pos_hub.coupon_redemption_customer_coupon_idx;
drop index if exists pos_hub.customer_consent_customer_time_idx;
drop table if exists pos_hub.customer_visit;

alter table pos_hub.coupon
  drop column if exists label,
  drop column if exists store_code;

alter table pos_hub.customer_consent
  drop constraint if exists customer_consent_consent_type_check,
  drop column if exists unsubscribed_at,
  drop column if exists consented_at,
  drop column if exists consent_type;

alter table pos_hub.customer
  drop column if exists email;

commit;
