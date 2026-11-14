import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { hashPin } from "../app/lib/pny-pos/crypto.ts";
import { emptyState } from "../app/lib/pny-pos/memory.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import { createSupabaseStateDb } from "../app/lib/pny-pos/supabaseState.ts";
import { runStore } from "../app/lib/pny-pos/storeContext.ts";
import { PNYS_STORE } from "../app/lib/pny-pos/storeProfile.ts";
import type { Secrets, State } from "../app/lib/pny-pos/types.ts";

const PREFIX = "DRY-R3B";
const SHIFT_ID = `${PREFIX}-SHIFT`;
const CUSTOMER_EMAIL = "dry-r3b@example.invalid";
const COUPON_CODE = `${PREFIX}-10`;
const NOW = new Date("2026-11-14T16:00:00.000Z");
const PRIVATE_DIR = resolve("artifacts/pnys-release3b");
const REPORT_DIR = resolve("reports/pnys-release3b");
export const CLEANUP_SQL_TEXT = [
  "begin;",
  "delete from pos_hub.coupon_redemption where shift_id='DRY-R3B-SHIFT' or coupon_id in (select id from pos_hub.coupon where code='DRY-R3B-10') or customer_id in (select id from pos_hub.customer where email='dry-r3b@example.invalid');",
  "delete from pos_hub.customer_visit where shift_id='DRY-R3B-SHIFT' or customer_id in (select id from pos_hub.customer where email='dry-r3b@example.invalid');",
  "delete from pos_hub.customer_consent where source='DRY-R3B-IN_STORE' or customer_id in (select id from pos_hub.customer where email='dry-r3b@example.invalid');",
  "delete from pos_hub.coupon where code='DRY-R3B-10';",
  "delete from pos_hub.customer where email='dry-r3b@example.invalid';",
  "delete from pnys_pos.sale where store_code='PNYS' and id like 'DRY-R3B-%';",
  "delete from pnys_pos.refill where store_code='PNYS' and kitchen_row_id like 'DRY-R3B-%';",
  "delete from pnys_pos.stock_count where store_code='PNYS' and id like 'DRY-R3B-%';",
  "delete from pnys_pos.deposit where store_code='PNYS' and id like 'DRY-R3B-%';",
  "delete from pnys_pos.closing where store_code='PNYS' and shift_id='DRY-R3B-SHIFT';",
  "delete from pnys_pos.shift where store_code='PNYS' and id='DRY-R3B-SHIFT';",
  "update pnys_pos.live_state state set doc=backup.doc,version=backup.version,updated_at=backup.updated_at from pnys_pos.release3b_backup backup where state.store_code='PNYS' and backup.run_id='DRY-R3B-20261114';",
  "drop table pnys_pos.release3b_backup;",
  "commit;",
].join("\n");

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    values[match[1]!] = value;
  }
  return values;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function balanceProof(doc: State) {
  const rows = doc.balances.filter((row) => !row.store_code || row.store_code === "PNYS").map((row) => ({ sku: row.sku, qty: row.qty })).sort((a, b) => a.sku.localeCompare(b.sku, "en", { numeric: true }));
  return { count: rows.length, units: rows.reduce((sum, row) => sum + row.qty, 0), checksum: sha(rows) };
}

function ephemeralPin(digits = 6) {
  const min = 10 ** (digits - 1);
  return String(Number.parseInt(randomBytes(4).toString("hex"), 16) % (9 * min) + min);
}

async function counts(client: PoolClient) {
  const result = await client.query(`select jsonb_build_object(
    'pnys_shift',(select count(*) from pnys_pos.shift where store_code='PNYS'),
    'pnys_sale',(select count(*) from pnys_pos.sale where store_code='PNYS'),
    'pnys_refill',(select count(*) from pnys_pos.refill where store_code='PNYS'),
    'pnys_count',(select count(*) from pnys_pos.stock_count where store_code='PNYS'),
    'pnys_deposit',(select count(*) from pnys_pos.deposit where store_code='PNYS'),
    'pnys_closing',(select count(*) from pnys_pos.closing where store_code='PNYS'),
    'hub_customer',(select count(*) from pos_hub.customer),
    'hub_consent',(select count(*) from pos_hub.customer_consent),
    'hub_visit',(select count(*) from pos_hub.customer_visit),
    'hub_coupon',(select count(*) from pos_hub.coupon),
    'hub_redemption',(select count(*) from pos_hub.coupon_redemption)
  ) as counts`);
  return result.rows[0].counts as Record<string, number>;
}

async function dryRowCount(client: PoolClient) {
  const result = await client.query(`select
    (select count(*) from pnys_pos.shift where id like $1 or doc::text like $1) +
    (select count(*) from pnys_pos.sale where id like $1 or doc::text like $1) +
    (select count(*) from pnys_pos.refill where kitchen_row_id like $1 or doc::text like $1) +
    (select count(*) from pnys_pos.stock_count where id like $1 or doc::text like $1) +
    (select count(*) from pnys_pos.deposit where id like $1 or doc::text like $1) +
    (select count(*) from pnys_pos.closing where shift_id like $1 or doc::text like $1) +
    (select count(*) from pos_hub.customer where email=$2) +
    (select count(*) from pos_hub.customer_consent where source=$3) +
    (select count(*) from pos_hub.customer_visit where shift_id=$4 or sale_id like $1) +
    (select count(*) from pos_hub.coupon where code=$5) +
    (select count(*) from pos_hub.coupon_redemption where shift_id=$4 or sale_id like $1) as count`, [`${PREFIX}%`, CUSTOMER_EMAIL, `${PREFIX}-IN_STORE`, SHIFT_ID, COUPON_CODE]);
  return Number(result.rows[0].count);
}

async function materialize(client: PoolClient, state: State) {
  const shift = state.shifts.find((row) => row.sccx_shift_id === SHIFT_ID);
  if (!shift) throw new Error("DRY-R3B shift is missing from database state.");
  const sales = state.sales.filter((row) => row.shift_id === shift.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const refill = state.incoming.find((row) => row.confirmed_shift_id === shift.id);
  const count = state.counts.find((row) => row.shift_id === shift.id && row.kind === "CLOSING");
  const deposit = state.deposits.find((row) => row.shift_id === shift.id);
  const closing = state.closings.find((row) => row.shift_id === shift.id);
  if (sales.length !== 2 || !refill || !count || !deposit || !closing) throw new Error("DRY-R3B database state is incomplete.");
  await client.query("begin");
  try {
    await client.query("insert into pnys_pos.shift(store_code,id,staff_uid,status,started_at,ended_at,doc) values('PNYS',$1,$2,$3,$4,$5,$6::jsonb)", [SHIFT_ID, shift.staff_uid, shift.status, shift.started_at, shift.ended_at, JSON.stringify(shift)]);
    for (const [index, sale] of sales.entries()) await client.query("insert into pnys_pos.sale(store_code,id,shift_id,payment_method,status,total_cents,created_at,doc) values('PNYS',$1,$2,$3,$4,$5,$6,$7::jsonb)", [`${PREFIX}-SALE-${index === 0 ? "CASH" : "DEBIT"}`, SHIFT_ID, sale.payment_method, sale.status, sale.total_cents, sale.created_at, JSON.stringify(sale)]);
    await client.query("insert into pnys_pos.refill(store_code,kitchen_row_id,sku,qty_sent,status,doc) values('PNYS',$1,$2,$3,$4,$5::jsonb)", [`${PREFIX}-REFILL`, refill.sku, refill.qty_sent, refill.status, JSON.stringify(refill)]);
    await client.query("insert into pnys_pos.stock_count(store_code,id,shift_id,kind,doc) values('PNYS',$1,$2,'CLOSING',$3::jsonb)", [`${PREFIX}-CLOSE-COUNT`, SHIFT_ID, JSON.stringify({ count, lines: state.count_lines.filter((row) => row.count_id === count.id) })]);
    await client.query("insert into pnys_pos.deposit(store_code,id,shift_id,amount_cents,deposit_code,created_at,doc) values('PNYS',$1,$2,$3,$4,$5,$6::jsonb)", [`${PREFIX}-DEPOSIT`, SHIFT_ID, deposit.amount_cents, deposit.deposit_code, deposit.created_at, JSON.stringify(deposit)]);
    await client.query("insert into pnys_pos.closing(store_code,shift_id,float_cents,deposited_cents,cash_sales_cents,doc) values('PNYS',$1,$2,$3,$4,$5::jsonb)", [SHIFT_ID, closing.float_cents ?? 0, closing.final_deposit_cents ?? closing.deposited_cents, closing.cash_sales_cents, JSON.stringify(closing)]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function runRelease3b(env: Record<string, string>, writeArtifacts = false) {
  if (env.STORE_CODE !== "PNYS" || env.POS_DB_SCHEMA !== "pnys_pos" || env.POS_HUB_SCHEMA !== "pos_hub" || !env.POS_SUPABASE_DB_URL) throw new Error("Fail closed: expected PNYS preview database settings.");
  if (/pny1-pos|pny_pos(?!s)/i.test(env.VERCEL_URL || "")) throw new Error("Fail closed: PNY01 target detected.");
  const connectionString = env.POS_SUPABASE_DB_URL;
  const pool = new Pool({ connectionString, max: 2, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  let backup: { version: number; updated_at: string; doc: State; counts: Record<string, number>; balances: ReturnType<typeof balanceProof>; doc_checksum: string } | null = null;
  let seeded = false;
  try {
    const loaded = await client.query("select version, updated_at::text, doc from pnys_pos.live_state where store_code='PNYS'");
    if (loaded.rowCount !== 1) throw new Error("Fail closed: PNYS live_state row was not found.");
    const preDoc = loaded.rows[0].doc as State;
    backup = { version: Number(loaded.rows[0].version), updated_at: loaded.rows[0].updated_at, doc: preDoc, counts: await counts(client), balances: balanceProof(preDoc), doc_checksum: sha(preDoc) };
    if (await dryRowCount(client) !== 0) throw new Error("Fail closed: pre-existing DRY-R3B rows found.");
    if ((await client.query("select to_regclass('pnys_pos.release3b_backup') as table_name")).rows[0].table_name) throw new Error("Fail closed: a prior Release 3b backup table exists.");
    await client.query(`create table pnys_pos.release3b_backup (
      run_id text primary key check (run_id = 'DRY-R3B-20261114'), version bigint not null,
      updated_at timestamptz not null, doc jsonb not null, table_counts jsonb not null,
      balance_proof jsonb not null, created_at timestamptz not null default now()
    )`);
    await client.query(`insert into pnys_pos.release3b_backup(run_id,version,updated_at,doc,table_counts,balance_proof)
    values('DRY-R3B-20261114',$1,$2,$3::jsonb,$4::jsonb,$5::jsonb)`, [backup.version, backup.updated_at, JSON.stringify(backup.doc), JSON.stringify(backup.counts), JSON.stringify(backup.balances)]);
    await client.query(`revoke all on pnys_pos.release3b_backup from public;
    alter table pnys_pos.release3b_backup enable row level security;
    alter table pnys_pos.release3b_backup force row level security;`);
    if (writeArtifacts) {
      await mkdir(PRIVATE_DIR, { recursive: true });
      await writeFile(resolve(PRIVATE_DIR, "private-backup.json"), JSON.stringify(backup));
    }

    const testState = emptyState(NOW.toISOString());
    testState.stores = [{ code: "PNYS", name: "PNYS DRY RUN", active: true, timezone: "America/Toronto", prices_tax_included: true, weed_in_store: true, ticket_letter_seq: 0, created_at: NOW.toISOString() }];
    const products = [
      { sku: "9901-3g", name: "DRY-R3B Flower", category: "FLOWER", price: 2000, qty: 6, thc: true },
      { sku: "9902", name: "DRY-R3B Paper", category: "ADD ONS", price: 2500, qty: 10, thc: false },
      { sku: "9903", name: "DRY-R3B Lighter", category: "ADD ONS", price: 500, qty: 5, thc: false },
    ];
    for (const [index, row] of products.entries()) {
      testState.products.push({ sku: row.sku, thc_flag: row.thc, sku_sort: 9901 + index, name: row.name, category: row.category, default_price_cents: row.price, image_url: null, setb_active: true, synced_at: NOW.toISOString(), created_at: NOW.toISOString() });
      testState.store_products.push({ store_code: "PNYS", sku: row.sku, enabled: true, price_override_cents: row.price, created_at: NOW.toISOString(), updated_at: NOW.toISOString() });
      testState.balances.push({ store_code: "PNYS", sku: row.sku, qty: row.qty, created_at: NOW.toISOString(), updated_at: NOW.toISOString() });
    }
    testState.opening_stock_at = NOW.toISOString();
    const seededRow = await client.query("update pnys_pos.live_state set doc=$1::jsonb, version=version+1, updated_at=now() where store_code='PNYS' and version=$2 returning version", [JSON.stringify(testState), backup.version]);
    if (seededRow.rowCount !== 1) throw new Error("Fail closed: PNYS state changed before seed write.");
    seeded = true;

    const staffPin = ephemeralPin(4);
    let kitchenPin = ephemeralPin(), managerPin = ephemeralPin();
    while (kitchenPin === staffPin) kitchenPin = ephemeralPin();
    while (managerPin === staffPin || managerPin === kitchenPin) managerPin = ephemeralPin();
    process.env.PNY_KITCHEN_PIN_HASH = hashPin(kitchenPin);
    process.env.PNY_MASTER_PIN_HASH = hashPin(managerPin);
    const secrets: Secrets = { shift: env.SHIFT_SECRET!, roster: env.ROSTER_SECRET!, poll: env.CRON_SECRET!, session: env.SESSION_SECRET!, admin: env.ADMIN_SECRET!, cron: env.CRON_SECRET! };
    const clock = { value: NOW };
    const db = createSupabaseStateDb(connectionString, "PNYS", "pnys_pos");
    const svc = new PosService(db, { now: () => clock.value, sheet: new LocalSheet(), secrets });
    const inPnys = <T>(run: () => Promise<T>) => runStore(PNYS_STORE, run);

    await inPnys(() => svc.openShiftWithPin({ staff_uid: `${PREFIX}-STAFF`, display_name: "DRY-R3B Staff", pos_id: `${PREFIX}-POS`, sccx_id: `${PREFIX}-SCCX`, shift_id: SHIFT_ID, pin: staffPin }));
    const staff = await inPnys(() => svc.login(staffPin, `${PREFIX}-CLIENT`));
    const manager = await inPnys(() => svc.managerLogin(managerPin, `${PREFIX}-MANAGER`));
    const kitchen = await inPnys(() => svc.kitchenLogin(kitchenPin, `${PREFIX}-KITCHEN`));
    await inPnys(() => svc.managerCreateCoupon(manager.token, { key: `${PREFIX}-COUPON-CMD`, code: COUPON_CODE, label: "DRY-R3B $10 test coupon", discount_type: "FIXED", discount_value: 1000, min_spend_cents: 5000, max_redemptions_per_customer: 1, confirm: true }));
    clock.value = new Date("2026-11-14T16:05:00.000Z");
    await inPnys(() => svc.cashout(staff.token, { key: `${PREFIX}-SALE-CASH-CMD`, payment_method: "CASH", lines: [{ sku: "9902", qty: 2 }], customer: { phone: "4165550198", name: "DRY-R3B Customer", email: CUSTOMER_EMAIL, consent_type: "EXPRESS", consented_at: clock.value.toISOString(), consent_source: `${PREFIX}-IN_STORE` }, coupon_code: COUPON_CODE }));
    clock.value = new Date("2026-11-14T16:10:00.000Z");
    const refill = await inPnys(() => svc.queueKitchenRefill(kitchen.token, { key: `${PREFIX}-REFILL-CMD`, lines: [{ sku: "9902", qty: 3 }] })) as { lines: Array<{ kitchen_row_id: string }> };
    await inPnys(() => svc.confirmIncoming(staff.token, { key: `${PREFIX}-REFILL-CONFIRM`, lines: [{ kitchen_row_id: refill.lines[0]!.kitchen_row_id, qty_received: 3 }] }));
    clock.value = new Date("2026-11-14T16:15:00.000Z");
    await inPnys(() => svc.managerSetWeedMode(manager.token, { key: `${PREFIX}-NO-WEED`, weed_in_store: false, confirm: true }));
    let thcBlocked = false;
    try { await inPnys(() => svc.cashout(staff.token, { key: `${PREFIX}-THC-BLOCK`, payment_method: "CASH", lines: [{ sku: "9901-3g", qty: 1 }] })); }
    catch (error) { thcBlocked = error instanceof PosError && error.code === "THC_HIDDEN"; }
    if (!thcBlocked) throw new Error("NO WEED did not block the database-backed THC sale.");
    await inPnys(() => svc.cashout(staff.token, { key: `${PREFIX}-SALE-DEBIT-CMD`, payment_method: "DEBIT", lines: [{ sku: "9903", qty: 1 }] }));
    clock.value = new Date("2026-11-14T16:25:00.000Z");
    await inPnys(() => svc.startClosingCount(staff.token));
    const closingView = await inPnys(() => svc.state(staff.token));
    for (const line of closingView.close_lines ?? []) await inPnys(() => svc.saveClosingCount(staff.token, { sku: line.sku, counted_qty: line.sku === "9902" ? line.system_qty - 1 : line.system_qty }));
    await inPnys(() => svc.submitClosingCount(staff.token));
    await inPnys(() => svc.saveFinalDeposit(staff.token, { amount_cents: 4000, float_cents: 0 }));
    clock.value = new Date("2026-11-14T16:30:00.000Z");
    await inPnys(() => svc.endShiftFromPos(staff.token, { key: `${PREFIX}-CLOSE-CMD`, lines: [], final_deposit_cents: 4000, float_cents: 0 }));

    const finalLoaded = await client.query("select version,doc from pnys_pos.live_state where store_code='PNYS'");
    const finalVersion = Number(finalLoaded.rows[0].version);
    const finalState = finalLoaded.rows[0].doc as State;
    await materialize(client, finalState);
    const shift = finalState.shifts.find((row) => row.sccx_shift_id === SHIFT_ID)!;
    const closingCount = finalState.counts.find((row) => row.shift_id === shift.id && row.kind === "CLOSING")!;
    const sales = finalState.sales.filter((row) => row.shift_id === shift.id && row.status === "COMPLETED");
    const saleIds = new Set(sales.map((row) => row.id));
    const stock = products.map((product) => {
      const refills = finalState.incoming.filter((row) => row.sku === product.sku && row.confirmed_shift_id === shift.id).reduce((sum, row) => sum + (row.qty_received ?? 0), 0);
      const sold = finalState.sale_lines.filter((row) => row.sku === product.sku && saleIds.has(row.sale_id)).reduce((sum, row) => sum + row.qty, 0);
      const expected = product.qty + refills - sold;
      const counted = finalState.count_lines.find((row) => row.count_id === closingCount.id && row.sku === product.sku)?.counted_qty ?? 0;
      return { sku: product.sku, opening: product.qty, refills, sales: sold, expected, counted, variance: counted - expected };
    });
    const hub = await client.query(`select
      (select count(*) from pos_hub.customer where email=$1)::int customer_rows,
      (select count(*) from pos_hub.customer_consent where source=$2)::int consent_rows,
      (select count(*) from pos_hub.customer_visit where shift_id=$3)::int visit_rows,
      (select count(*) from pos_hub.coupon where code=$4)::int coupon_rows,
      (select count(*) from pos_hub.coupon_redemption where shift_id=$3)::int redemption_rows`, [CUSTOMER_EMAIL, `${PREFIX}-IN_STORE`, shift.id, COUPON_CODE]);
    const mirrorCounts = await client.query(`select
      (select count(*) from pnys_pos.shift where id=$1)::int shift_rows,
      (select count(*) from pnys_pos.sale where id like $2)::int sale_rows,
      (select count(*) from pnys_pos.refill where kitchen_row_id=$3)::int refill_rows,
      (select count(*) from pnys_pos.stock_count where id=$4)::int count_rows,
      (select count(*) from pnys_pos.deposit where id=$5)::int deposit_rows,
      (select count(*) from pnys_pos.closing where shift_id=$1)::int closing_rows`, [SHIFT_ID, `${PREFIX}-SALE-%`, `${PREFIX}-REFILL`, `${PREFIX}-CLOSE-COUNT`, `${PREFIX}-DEPOSIT`]);
    const closing = finalState.closings.find((row) => row.shift_id === shift.id)!;
    const gross = finalState.sale_lines.filter((row) => saleIds.has(row.sale_id)).reduce((sum, row) => sum + row.qty * row.unit_price_cents, 0);
    const cash = { gross_sales_cents: gross, coupon_discount_cents: gross - sales.reduce((sum, row) => sum + row.total_cents, 0), net_sales_cents: sales.reduce((sum, row) => sum + row.total_cents, 0), cash_sales_cents: sales.filter((row) => row.payment_method === "CASH").reduce((sum, row) => sum + row.total_cents, 0), debit_sales_cents: sales.filter((row) => row.payment_method === "DEBIT").reduce((sum, row) => sum + row.total_cents, 0), deposited_cents: closing.final_deposit_cents ?? closing.deposited_cents, end_float_cents: closing.float_cents ?? 0 };
    const databaseResult = { source: "pnys_pos.live_state + pnys_pos relational mirrors + pos_hub", final_version: finalVersion, stock, cash: { ...cash, direct_variance_cents: cash.cash_sales_cents - cash.deposited_cents - cash.end_float_cents }, shortage_cents: closing.shortage_cents, hub_rows: hub.rows[0], mirror_rows: mirrorCounts.rows[0], opening_float_formula: "ACCOUNTANT DECISION REQUIRED — placeholder only; no formula selected" };
    if (sha(stock) !== sha([{ sku: "9901-3g", opening: 6, refills: 0, sales: 0, expected: 6, counted: 6, variance: 0 }, { sku: "9902", opening: 10, refills: 3, sales: 2, expected: 11, counted: 10, variance: -1 }, { sku: "9903", opening: 5, refills: 0, sales: 1, expected: 4, counted: 4, variance: 0 }])) throw new Error("Database stock reconciliation did not match Release 3.");
    if (cash.gross_sales_cents !== 5500 || cash.coupon_discount_cents !== 1000 || cash.net_sales_cents !== 4500 || cash.cash_sales_cents !== 4000 || cash.debit_sales_cents !== 500 || cash.deposited_cents !== 4000 || databaseResult.cash.direct_variance_cents !== 0 || closing.shortage_cents !== 2500) throw new Error("Database cash reconciliation did not match Release 3.");
    if (Object.values(hub.rows[0] as Record<string, number>).some((value) => Number(value) !== 1)) throw new Error("Expected one row in every pos_hub test table.");
    if (canonical(mirrorCounts.rows[0]) !== canonical({ shift_rows: 1, sale_rows: 2, refill_rows: 1, count_rows: 1, deposit_rows: 1, closing_rows: 1 })) throw new Error("PNYS relational mirror rows are incomplete.");

    await client.query(CLEANUP_SQL_TEXT);
    seeded = false;
    const postLoaded = await client.query("select version,updated_at::text,doc from pnys_pos.live_state where store_code='PNYS'");
    const post = { version: Number(postLoaded.rows[0].version), updated_at: postLoaded.rows[0].updated_at, doc_checksum: sha(postLoaded.rows[0].doc), balances: balanceProof(postLoaded.rows[0].doc), counts: await counts(client), dry_rows: await dryRowCount(client) };
    const cleanupVerified = post.version === backup.version && post.doc_checksum === backup.doc_checksum && canonical(post.balances) === canonical(backup.balances) && canonical(post.counts) === canonical(backup.counts) && post.dry_rows === 0;
    if (!cleanupVerified) throw new Error("Cleanup verification failed; private backup retained.");

    const report = { release: "PNYS Release 3b", scope: "PNYS preview database only", prefix: PREFIX, backup: { version: backup.version, doc_checksum: backup.doc_checksum, balances: backup.balances, counts: backup.counts }, database_result: databaseResult, cleanup: { verified: true, post } };
    if (writeArtifacts) {
      await mkdir(REPORT_DIR, { recursive: true });
      await writeFile(resolve(REPORT_DIR, "reconciliation.json"), JSON.stringify(report, null, 2));
    }
    const money = (value: number) => `$${(value / 100).toFixed(2)}`;
    const markdown = `# PNYS Release 3b — Database Dry Run\n\nStatus: **PASSED AND CLEANED**\n\nScope: PNYS preview database only. No pny_pos or pny1-pos access.\n\n## Database reconciliation\n\n| SKU | Opening | Refills | Sales | Expected | Counted | Variance |\n|---|---:|---:|---:|---:|---:|---:|\n${stock.map((row) => `| ${row.sku} | ${row.opening} | ${row.refills} | ${row.sales} | ${row.expected} | ${row.counted} | ${row.variance} |`).join("\n")}\n\n- Gross merchandise: ${money(cash.gross_sales_cents)}\n- Coupon: -${money(cash.coupon_discount_cents)}\n- Net sales: ${money(cash.net_sales_cents)}\n- Cash / debit: ${money(cash.cash_sales_cents)} / ${money(cash.debit_sales_cents)}\n- Deposit: ${money(cash.deposited_cents)}\n- Cash variance: ${money(databaseResult.cash.direct_variance_cents)}\n- Stock short: ${money(closing.shortage_cents)}\n\n> **ACCOUNTANT DECISION REQUIRED — opening-float formula remains a placeholder.**\n\n## Cleanup proof\n\n- Full live_state checksum restored: ${post.doc_checksum}\n- Balance checksum restored: ${post.balances.checksum}\n- Balance rows / units restored: ${post.balances.count} / ${post.balances.units}\n- All affected table counts match the backup: yes\n- Remaining DRY-R3B rows: 0\n`;
    if (writeArtifacts) await writeFile(resolve(REPORT_DIR, "reconciliation.md"), markdown);
    return { ...report, markdown };
  } finally {
    if (seeded && backup) {
      try { await client.query(CLEANUP_SQL_TEXT); }
      catch { process.stderr.write("Emergency cleanup failed; use the private backup and guarded undo immediately.\n"); }
    }
    client.release();
    await pool.end();
  }
}

if (process.env.PNYS_RELEASE3B_CLI === "1") {
  const envPromise = process.argv[2]
    ? readFile(process.argv[2], "utf8").then(parseEnv)
    : Promise.resolve(Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
  void envPromise.then((env) => runRelease3b(env, true)).then(() => { process.stdout.write("PNYS Release 3b database dry run passed, reconciled, cleaned, and restored.\n"); process.exit(0); }).catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "Release 3b failed."}\n`); process.exit(1); });
}
