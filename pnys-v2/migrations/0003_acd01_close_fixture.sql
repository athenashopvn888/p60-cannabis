begin;

-- ACD01 preview data lives only in the isolated v2 schemas. No plaintext PIN exists.
insert into pos_v2.staff(store_code, staff_id, display_name, pin_hash, role)
values ('ACD01','00000000-0000-4000-8000-00000000a001','Test Staff','scrypt$deadbeef$cafebabe','STAFF')
on conflict (store_code, staff_id) do nothing;

insert into pos_v2.shifts(store_code, shift_id, shift_code, staff_id, status, started_at, ended_at)
values (
  'ACD01','00000000-0000-4000-8000-00000000b001','S00001',
  '00000000-0000-4000-8000-00000000a001','CLOSED',
  '2026-11-18T14:00:00Z','2026-11-19T02:00:00Z'
)
on conflict (store_code, shift_id) do nothing;

insert into pos_v2.close_versions(
  store_code, close_id, shift_id, version, input_json, result_json, parity_hash, created_by
) values (
  'ACD01',
  '00000000-0000-4000-8000-00000000c001',
  '00000000-0000-4000-8000-00000000b001',
  1,
  '{"storeCode":"ACD01","shiftCode":"S00001","staffName":"Test Staff","openingCashCents":5200,"cashSalesCents":65900,"safeboxCents":83500,"closingFloatCents":8300,"lines":[{"sku":"172-3g","name":"Lavender Kush 3g","expectedQty":8,"countedQty":7,"unitPriceCents":2000},{"sku":"240","name":"Grabba","expectedQty":12,"countedQty":10,"unitPriceCents":500},{"sku":"396-3g","name":"Khalifa Kush 3g","expectedQty":18,"countedQty":20,"unitPriceCents":2000},{"sku":"593-6g","name":"Mike Tyson KO 6g","expectedQty":4,"countedQty":4,"unitPriceCents":4000}]}'::jsonb,
  '{"schemaVersion":1,"input":{"storeCode":"ACD01","shiftCode":"S00001","staffName":"Test Staff","openingCashCents":5200,"cashSalesCents":65900,"safeboxCents":83500,"closingFloatCents":8300},"differences":[{"sku":"172-3g","name":"Lavender Kush 3g","expectedQty":8,"countedQty":7,"unitPriceCents":2000,"qtyDiff":-1,"valueDiffCents":-2000,"result":"SHORT"},{"sku":"240","name":"Grabba","expectedQty":12,"countedQty":10,"unitPriceCents":500,"qtyDiff":-2,"valueDiffCents":-1000,"result":"SHORT"},{"sku":"396-3g","name":"Khalifa Kush 3g","expectedQty":18,"countedQty":20,"unitPriceCents":2000,"qtyDiff":2,"valueDiffCents":4000,"result":"OVER"}],"totalShortQty":3,"totalExtraQty":2,"totalShortCents":3000,"totalExtraCents":4000,"netStockCents":1000,"netStockKind":"OVER","expectedCashCents":70100,"cashAccountedCents":91800,"finalVarianceCents":21700,"finalKind":"OVER","parityHash":"be0cb5a1e28e408ecb13aa161e703c1c1f4d42a67377b3b214277a3d1c3ef7c1"}'::jsonb,
  'be0cb5a1e28e408ecb13aa161e703c1c1f4d42a67377b3b214277a3d1c3ef7c1',
  'v2-seed'
)
on conflict (store_code, close_id, version) do nothing;

insert into pos_v2.close_lines(
  store_code, close_id, version, sku, expected_qty, counted_qty, unit_price_cents, qty_diff, value_diff_cents
) values
  ('ACD01','00000000-0000-4000-8000-00000000c001',1,'172-3g',8,7,2000,-1,-2000),
  ('ACD01','00000000-0000-4000-8000-00000000c001',1,'240',12,10,500,-2,-1000),
  ('ACD01','00000000-0000-4000-8000-00000000c001',1,'396-3g',18,20,2000,2,4000),
  ('ACD01','00000000-0000-4000-8000-00000000c001',1,'593-6g',4,4,4000,0,0)
on conflict (store_code, close_id, version, sku) do nothing;

commit;
