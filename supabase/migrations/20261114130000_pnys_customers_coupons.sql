-- PNYS Release 2g. Extends only pos_hub; never reads or writes pny_pos.
begin;

alter table pos_hub.customer
  add column if not exists email text;

alter table pos_hub.customer_consent
  add column if not exists consent_type text,
  add column if not exists consented_at timestamptz,
  add column if not exists unsubscribed_at timestamptz;

alter table pos_hub.customer_consent
  drop constraint if exists customer_consent_consent_type_check;
alter table pos_hub.customer_consent
  add constraint customer_consent_consent_type_check
  check (consent_type is null or consent_type in ('EXPRESS','IMPLIED'));

create table if not exists pos_hub.customer_visit (
  id uuid primary key,
  customer_id uuid not null references pos_hub.customer(id),
  store_code text not null references pos_hub.store(store_code),
  sale_id text not null,
  shift_id text not null,
  spend_cents integer not null check (spend_cents >= 0),
  visited_at timestamptz not null,
  unique (store_code, sale_id)
);

alter table pos_hub.coupon
  add column if not exists store_code text references pos_hub.store(store_code),
  add column if not exists label text;

create index if not exists customer_visit_customer_time_idx
  on pos_hub.customer_visit(customer_id, visited_at desc);
create index if not exists customer_consent_customer_time_idx
  on pos_hub.customer_consent(customer_id, recorded_at desc);
create index if not exists coupon_redemption_customer_coupon_idx
  on pos_hub.coupon_redemption(customer_id, coupon_id, redeemed_at desc);

revoke all on pos_hub.customer_visit from public;
grant select, insert, update, delete on pos_hub.customer_visit to pnys_app;
alter table pos_hub.customer_visit enable row level security;
alter table pos_hub.customer_visit force row level security;
drop policy if exists pnys_app_all on pos_hub.customer_visit;
create policy pnys_app_all on pos_hub.customer_visit
  for all to pnys_app using (true) with check (true);

commit;
