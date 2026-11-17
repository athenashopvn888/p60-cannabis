import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.POS_SUPABASE_DB_URL?.trim();
  if (!url) throw new Error("POS_SUPABASE_DB_URL is missing; refusing to apply Release 2g.");

  const migrationPath = resolve("supabase/migrations/20261114130000_pnys_customers_coupons.sql");
  const migration = await readFile(migrationPath, "utf8");
  if (/\bpny_pos\b/i.test(migration.replace(/^\s*--.*$/gm, ""))) throw new Error("Migration unexpectedly references pny_pos.");

  const pool = new Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
  const required = await client.query("select to_regclass('pnys_pos.live_state')::text as pnys, to_regclass('pos_hub.customer')::text as customer, to_regclass('pos_hub.coupon')::text as coupon");
  if (required.rows[0]?.pnys !== "pnys_pos.live_state" || required.rows[0]?.customer !== "pos_hub.customer" || required.rows[0]?.coupon !== "pos_hub.coupon") throw new Error("PNYS foundation tables are missing; refusing migration.");
  const schema = await client.query("select table_schema, table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='pos_hub' and table_name in ('customer','customer_consent','customer_opt_out','coupon','coupon_redemption') order by table_name, ordinal_position");
  const counts = await client.query("select (select count(*) from pos_hub.customer)::int as customers, (select count(*) from pos_hub.customer_consent)::int as consents, (select count(*) from pos_hub.coupon)::int as coupons, (select count(*) from pos_hub.coupon_redemption)::int as redemptions");
  const backupDir = resolve("artifacts/pnys-release-2g");
  await mkdir(backupDir, { recursive: true });
  await writeFile(resolve(backupDir, "pre-migration-schema.json"), JSON.stringify({ captured_at: new Date().toISOString(), columns: schema.rows, row_counts: counts.rows[0] }, null, 2), { flag: "wx" });
  await client.query(migration);
  const verify = await client.query("select to_regclass('pos_hub.customer_visit')::text as visit, exists(select 1 from information_schema.columns where table_schema='pos_hub' and table_name='customer' and column_name='email') as email, exists(select 1 from information_schema.columns where table_schema='pos_hub' and table_name='customer_consent' and column_name='consent_type') as consent_type, c.relrowsecurity as rls, c.relforcerowsecurity as forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='pos_hub' and c.relname='customer_visit'");
  const row = verify.rows[0];
  if (row?.visit !== "pos_hub.customer_visit" || row?.email !== true || row?.consent_type !== true || row?.rls !== true || row?.forced !== true) throw new Error("Release 2g verification failed.");
  process.stdout.write("PNYS Release 2g schema applied and verified; no customer rows were created.\n");
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Release 2g migration failed."}\n`);
  process.exitCode = 1;
});
