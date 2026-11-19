begin;
insert into pos_v2_hub.store_runtime(store_code, write_mode, active_generation, app_version)
values ('ACD01','FROZEN',1,'v2-preview') on conflict (store_code) do nothing;
insert into pos_v2.stores(store_code, display_name, test_store) values ('ACD01','Amesbury Cannabis Dispensary Test',true) on conflict (store_code) do nothing;
insert into pos_v2.store_settings(store_code, opening_count_enabled) values ('ACD01',true) on conflict (store_code) do nothing;
insert into pos_v2.catalog_items(store_code,sku,name,size_label,tier,thc,price_cents) values
  ('ACD01','172-3g','Lavender Kush','3g','Premium',true,2000),
  ('ACD01','240','Grabba','each','Add Ons',false,500),
  ('ACD01','396-3g','Khalifa Kush','3g','Budget',true,2000),
  ('ACD01','593-6g','Mike Tyson KO','6g','AAA+',true,4000)
on conflict (store_code,sku) do nothing;
insert into pos_v2.inventory_balances(store_code,sku,quantity) values
  ('ACD01','172-3g',7),('ACD01','240',10),('ACD01','396-3g',20),('ACD01','593-6g',4)
on conflict (store_code,sku) do nothing;
commit;
