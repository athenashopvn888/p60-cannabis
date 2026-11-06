-- Row ids are per store. The same demo id can exist on PNY01 and PNY02.
alter table pny_pos.shift drop constraint if exists shift_pkey;
alter table pny_pos.shift add primary key (store_code, id);

alter table pny_pos.sale drop constraint if exists sale_pkey;
alter table pny_pos.sale add primary key (store_code, id);

alter table pny_pos.deposit drop constraint if exists deposit_pkey;
alter table pny_pos.deposit add primary key (store_code, id);

alter table pny_pos.stock_count drop constraint if exists stock_count_pkey;
alter table pny_pos.stock_count add primary key (store_code, id);

alter table pny_pos.refill drop constraint if exists refill_pkey;
alter table pny_pos.refill add primary key (store_code, kitchen_row_id);

alter table pny_pos.closing drop constraint if exists closing_pkey;
alter table pny_pos.closing add primary key (store_code, shift_id);
