import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import { catalogFromFeed, defaultSetbProductsUrl } from "../app/lib/pny-pos/setbFeed.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

type Json = Record<string, unknown>;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Json).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

function checksum(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function list(doc: Json, key: string) {
  return Array.isArray(doc[key]) ? doc[key] as Json[] : [];
}

function cloneCatalog(source: Json): Json {
  const products = structuredClone(list(source, "products"));
  const storeProducts = list(source, "store_products")
    .filter((row) => row.store_code === "PNY01")
    .map((row) => ({ ...structuredClone(row), store_code: "PNYS" }));
  const balances = list(source, "balances")
    .filter((row) => (row.store_code ?? "PNY01") === "PNY01")
    .map((row) => ({ ...structuredClone(row), store_code: "PNYS" }));
  const stores = [{ code: "PNYS", name: "PNYS", active: true, timezone: "America/Toronto", prices_tax_included: false, ticket_letter_seq: 0, created_at: new Date().toISOString() }];
  return {
    products, store_products: storeProducts, balances, stores,
    staff: [], shifts: [], sessions: [], incoming: [], counts: [], count_lines: [],
    tickets: [], ticket_lines: [], sales: [], sale_lines: [], deposits: [], closings: [],
    closing_drafts: [], ledger: [], outbox: [], idempotency: [], cursors: [], audit: [],
    admin_sessions: [], deposit_seq: 0,
  };
}

function catalogView(doc: Json, store: "PNY01" | "PNYS") {
  return {
    products: list(doc, "products").map(({ sku, name, category, default_price_cents, thc_flag, setb_active }) => ({ sku, name, category, default_price_cents, thc_flag, setb_active })).sort((a,b) => String(a.sku).localeCompare(String(b.sku))),
    store_products: list(doc, "store_products").filter((row) => row.store_code === store).map(({ sku, enabled, price_override_cents }) => ({ sku, enabled, price_override_cents })).sort((a,b) => String(a.sku).localeCompare(String(b.sku))),
    balances: list(doc, "balances").filter((row) => (row.store_code ?? "PNY01") === store).map(({ sku, qty }) => ({ sku, qty })).sort((a,b) => String(a.sku).localeCompare(String(b.sku))),
  };
}

async function readState(client: PoolClient, store: "PNY01" | "PNY02") {
  await client.query("begin read only");
  try {
    const result = await client.query("select version, doc, updated_at from pny_pos.live_state where store_code=$1", [store]);
    if (result.rowCount !== 1) throw new Error(`${store} state not found`);
    await client.query("commit");
    return result.rows[0] as { version: string | number; doc: Json; updated_at: string };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const url = process.env.POS_SUPABASE_DB_URL?.trim();
  if (!url) throw new Error("POS_SUPABASE_DB_URL is required");
  const backupOnly = process.argv.includes("--backup-only");
  const cloneOnly = process.argv.includes("--clone-only");
  if (backupOnly && cloneOnly) throw new Error("Choose backup-only or clone-only, not both");
  const backupArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const backupDir = path.resolve(backupArg || "backups/pnys-foundation");
  const pool = new Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    let backupPath: string | null = null;
    let backupSha: string | null = null;
    if (!cloneOnly) {
      const old = await readState(client, "PNY02");
      await mkdir(backupDir, { recursive: true });
      const backup = { store_code: "PNY02", version: Number(old.version), updated_at: old.updated_at, doc: old.doc };
      const backupJson = `${JSON.stringify(backup, null, 2)}\n`;
      backupPath = path.join(backupDir, `pny02-readonly-${new Date().toISOString().replace(/[:.]/g,"-")}.json`);
      await writeFile(backupPath, backupJson, { flag: "wx", mode: 0o600 });
      backupSha = createHash("sha256").update(backupJson).digest("hex");
    }
    if (backupOnly) {
      console.log(JSON.stringify({ backup: backupPath, backup_sha256: backupSha, store_code: "PNY02", read_only: true }));
      return;
    }

    const source = await readState(client, "PNY01");
    const target = cloneCatalog(source.doc);
    const response = await fetch(defaultSetbProductsUrl(), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`PNY01 catalog feed returned ${response.status}`);
    const feed = catalogFromFeed(await response.json());
    if (feed.length < 200) throw new Error(`PNY01 catalog feed unexpectedly small: ${feed.length}`);
    const at = new Date().toISOString();
    const effectiveSource = structuredClone(source.doc) as unknown as State;
    materializeCatalog(effectiveSource, feed, "PNY01", at);
    materializeCatalog(target as unknown as State, feed, "PNYS", at);
    const sourceView = catalogView(effectiveSource as unknown as Json, "PNY01");
    const targetView = catalogView(target, "PNYS");
    const requiredSkus = ["396-3g", "406-3g", "406-5g", "419-3g", "419-5g"];
    const sourceSkus = new Set(sourceView.products.map((row) => String(row.sku)));
    const missing = requiredSkus.filter((sku) => !sourceSkus.has(sku));
    if (missing.length) throw new Error(`PNY01 source is missing required PNYS SKUs: ${missing.join(", ")}`);
    const sourceCounts = Object.fromEntries(Object.entries(sourceView).map(([key, value]) => [key, value.length]));
    const targetCounts = Object.fromEntries(Object.entries(targetView).map(([key, value]) => [key, value.length]));
    const sourceChecksum = checksum(sourceView);
    const targetChecksum = checksum(targetView);
    if (sourceChecksum !== targetChecksum || stable(sourceCounts) !== stable(targetCounts)) throw new Error("Catalog reconciliation failed before write");

    await client.query("begin");
    const prior = await client.query("select 1 from pnys_pos.clone_audit limit 1");
    if (prior.rowCount) throw new Error("PNYS one-time clone already completed");
    await client.query("insert into pnys_pos.live_state(store_code,version,doc) values ('PNYS',0,$1::jsonb)", [JSON.stringify(target)]);
    await client.query("insert into pnys_pos.clone_audit(clone_id,source_store,target_store,source_version,source_counts,target_counts,source_checksum,target_checksum,reconciled) values($1,'PNY01','PNYS',$2,$3::jsonb,$4::jsonb,$5,$6,true)", [randomUUID(), Number(source.version), JSON.stringify(sourceCounts), JSON.stringify(targetCounts), sourceChecksum, targetChecksum]);
    await client.query("commit");
    console.log(JSON.stringify({ source_version: Number(source.version), source_counts: sourceCounts, target_counts: targetCounts, source_checksum: sourceChecksum, target_checksum: targetChecksum, reconciled: true }));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await main();
} catch (error) {
  const secret = process.env.POS_SUPABASE_DB_URL ?? "";
  const raw = error instanceof Error ? error.message : "Unknown error";
  const withoutExactSecret = secret ? raw.replaceAll(secret, "[REDACTED]") : raw;
  const safe = withoutExactSecret.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED]");
  console.error(`PNYS foundation failed: ${safe}`);
  process.exitCode = 1;
}
