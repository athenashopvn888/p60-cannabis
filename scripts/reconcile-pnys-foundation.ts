import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { flowersFromGrid, parseCsv, PUBLISHED_FLOWER_CSV } from "../app/lib/pny-pos/flowerRaw.ts";
import { itemsFromGrid, SETB_ITEMS_CSV } from "../app/lib/pny-pos/itemRaw.ts";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import { catalogFromFeed, defaultSetbProductsUrl } from "../app/lib/pny-pos/setbFeed.ts";
import { reconcileTillCatalog, type TillMenuItem } from "../app/lib/pny-pos/tillCatalog.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

type Json = Record<string, unknown>;
type LiveRow = { store_code: string; version: string | number; doc: State; updated_at: string };

const PNY01_MENU_URL = "https://pny1-pos.vercel.app/api/menu";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Json)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function safeError(error: unknown, secret: string) {
  const raw = error instanceof Error ? error.message : String(error);
  return (secret ? raw.replaceAll(secret, "[REDACTED]") : raw).replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED]");
}

function metrics(state: State, storeCode: string) {
  const products = new Map(state.products.map((row) => [row.sku, row]));
  const storeProducts = new Map(
    state.store_products.filter((row) => row.store_code === storeCode).map((row) => [row.sku, row]),
  );
  const balances = state.balances.filter((row) => (row.store_code ?? storeCode) === storeCode);
  let onHandUnits = 0;
  let pricedOnHandUnits = 0;
  let stockValueCents = 0;
  const missingCatalogSkus: string[] = [];
  const unpricedSkus: string[] = [];
  for (const balance of balances) {
    onHandUnits += balance.qty;
    const product = products.get(balance.sku);
    const storeProduct = storeProducts.get(balance.sku);
    if (!product || !storeProduct) {
      missingCatalogSkus.push(balance.sku);
      continue;
    }
    const price = storeProduct.price_override_cents ?? product.default_price_cents;
    if (price <= 0) {
      unpricedSkus.push(balance.sku);
      continue;
    }
    pricedOnHandUnits += balance.qty;
    stockValueCents += balance.qty * price;
  }
  return {
    catalog_count: state.products.length,
    store_product_count: state.store_products.filter((row) => row.store_code === storeCode).length,
    balance_sku_count: balances.length,
    on_hand_units: onHandUnits,
    priced_on_hand_units: pricedOnHandUnits,
    stock_value_cents: stockValueCents,
    thc_flagged_sku_count: state.products.filter((row) => row.thc_flag === true).length,
    missing_catalog_skus: [...new Set(missingCatalogSkus)].sort(),
    unpriced_skus: [...new Set(unpricedSkus)].sort(),
  };
}

function catalogView(state: State, storeCode: string) {
  return {
    products: state.products.map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category,
      default_price_cents: row.default_price_cents,
      thc_flag: row.thc_flag ?? false,
      setb_active: row.setb_active,
    })).sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true })),
    store_products: state.store_products.filter((row) => row.store_code === storeCode).map((row) => ({
      sku: row.sku,
      enabled: row.enabled,
      price_override_cents: row.price_override_cents,
    })).sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true })),
  };
}

async function readState(client: PoolClient, schema: "pny_pos" | "pnys_pos", store: "PNY01" | "PNYS") {
  await client.query("begin read only");
  try {
    const result = await client.query(`select store_code, version, doc, updated_at from ${schema}.live_state where store_code=$1`, [store]);
    if (result.rowCount !== 1) throw new Error(`${store} state not found`);
    await client.query("commit");
    return result.rows[0] as LiveRow;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

function stripTransaction(sql: string) {
  return sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "");
}

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Source returned ${response.status}: ${url}`);
  return response.text();
}

async function main() {
  const dbUrl = process.env.POS_SUPABASE_DB_URL?.trim() ?? "";
  if (!dbUrl) throw new Error("POS_SUPABASE_DB_URL is required");
  const outputDir = path.resolve(process.argv[2] || "backups/pnys-foundation");
  const migrationPath = new URL("../supabase/migrations/20261113193000_pnys_catalog_rls_reconciliation.sql", import.meta.url);
  const structuralUndoPath = new URL("../supabase/undo/20261113193000_pnys_catalog_rls_reconciliation.undo.sql", import.meta.url);
  const migration = await readFile(migrationPath, "utf8");
  const structuralUndo = await readFile(structuralUndoPath, "utf8");
  if (/\b(insert|update|delete|alter|drop|truncate)\s+(into\s+|table\s+)?pny_pos\b/i.test(migration)) {
    throw new Error("Safety check refused a migration that writes to pny_pos");
  }

  const pool = new Pool({
    connectionString: dbUrl,
    max: 1,
    ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const pny01 = await readState(client, "pny_pos", "PNY01");
    const pnys = await readState(client, "pnys_pos", "PNYS");
    const [feedText, menuText, flowerCsv, itemCsv] = await Promise.all([
      fetchText(defaultSetbProductsUrl()),
      fetchText(PNY01_MENU_URL),
      fetchText(PUBLISHED_FLOWER_CSV),
      fetchText(SETB_ITEMS_CSV),
    ]);
    const feedPayload = JSON.parse(feedText);
    const menuPayload = JSON.parse(menuText) as { ok?: boolean; store?: string; items?: TillMenuItem[] };
    if (!menuPayload.ok || menuPayload.store !== "PNY01" || !Array.isArray(menuPayload.items)) {
      throw new Error("PNY01 menu source did not return the expected payload");
    }
    const feed = catalogFromFeed(feedPayload);
    if (feed.length < 200) throw new Error(`PNY01 customer catalog unexpectedly small: ${feed.length}`);
    const flowers = flowersFromGrid(parseCsv(flowerCsv));
    const items = itemsFromGrid(parseCsv(itemCsv));
    if (flowers.size < 200 || items.size < 150) throw new Error("PNY01 till catalog source unexpectedly small");

    const at = new Date().toISOString();
    const sourceState = structuredClone(pny01.doc);
    const targetState = structuredClone(pnys.doc);
    materializeCatalog(sourceState, feed, "PNY01", at);
    materializeCatalog(targetState, feed, "PNYS", at);
    const sourceResolution = reconcileTillCatalog(sourceState, "PNY01", at, {
      flowers,
      items,
      menu: menuPayload.items,
    });
    const targetResolution = reconcileTillCatalog(targetState, "PNYS", at, {
      flowers,
      items,
      menu: menuPayload.items,
    });
    const store = targetState.stores.find((row) => row.code === "PNYS");
    if (!store) throw new Error("PNYS store row is missing");
    store.prices_tax_included = true;

    const sourceMetrics = metrics(sourceState, "PNY01");
    const targetMetrics = metrics(targetState, "PNYS");
    if (targetMetrics.missing_catalog_skus.length !== 0) throw new Error("Balance SKUs still lack catalog rows");
    if (sourceMetrics.catalog_count !== targetMetrics.catalog_count) throw new Error("PNY01 and PNYS catalog counts differ");
    const sourceView = catalogView(sourceState, "PNY01");
    const targetView = catalogView(targetState, "PNYS");
    const sourceChecksum = checksum(sourceView);
    const targetChecksum = checksum(targetView);
    if (sourceChecksum !== targetChecksum) throw new Error("PNY01 till catalog and PNYS catalog checksums differ");

    const cloneId = randomUUID();
    const oldDocText = JSON.stringify(pnys.doc);
    const newDocText = JSON.stringify(targetState);
    const oldDocChecksum = checksum(oldDocText);
    const newDocChecksum = checksum(newDocText);
    const newVersion = Number(pnys.version) + 1;
    const detail = {
      corrected_at: at,
      source_urls: {
        customer_catalog: defaultSetbProductsUrl(),
        pny01_till_menu: PNY01_MENU_URL,
        flowers_raw: PUBLISHED_FLOWER_CSV,
        items_raw_price_source: SETB_ITEMS_CSV,
      },
      source_sha256: {
        customer_catalog: checksum(feedText),
        pny01_till_menu: checksum(menuText),
        flowers_raw: checksum(flowerCsv),
        items_raw_price_source: checksum(itemCsv),
      },
      source_resolution: sourceResolution.sources,
      target_resolution: targetResolution.sources,
      target_source_by_sku: targetResolution.sourceBySku,
      prices_tax_included: true,
      rls: "enabled_and_forced_deny_by_default_pnys_app_only",
      source_metrics: sourceMetrics,
      target_metrics: targetMetrics,
    };
    const repairSql = `${migration.trim()}\n\nbegin;\nupdate pnys_pos.live_state\nset doc = ${sqlText(newDocText)}::jsonb, version = version + 1, updated_at = now()\nwhere store_code = 'PNYS' and version = ${Number(pnys.version)};\ninsert into pnys_pos.clone_audit (clone_id, source_store, target_store, source_version, source_counts, target_counts, source_checksum, target_checksum, reconciled, audit_kind, detail)\nvalues (${sqlText(cloneId)}::uuid, 'PNY01', 'PNYS', ${Number(pny01.version)}, ${sqlText(JSON.stringify(sourceMetrics))}::jsonb, ${sqlText(JSON.stringify(targetMetrics))}::jsonb, ${sqlText(sourceChecksum)}, ${sqlText(targetChecksum)}, true, 'catalog_rls_reconciliation', ${sqlText(JSON.stringify(detail))}::jsonb);\ncommit;\n`;
    const runtimeUndo = `-- Exact PNYS Release 1 reconciliation rollback. Never writes pny_pos.\nbegin;\ndo $undo$\ndeclare changed integer;\nbegin\n  update pnys_pos.live_state\n  set doc = ${sqlText(oldDocText)}::jsonb, version = ${Number(pnys.version)}, updated_at = ${sqlText(pnys.updated_at)}::timestamptz\n  where store_code = 'PNYS'\n    and encode(digest(doc::text, 'sha256'), 'hex') = ${sqlText(newDocChecksum)};\n  get diagnostics changed = row_count;\n  if changed <> 1 then raise exception 'PNYS reconciliation undo guard failed'; end if;\n  delete from pnys_pos.clone_audit where clone_id = ${sqlText(cloneId)}::uuid;\nend $undo$;\ncommit;\n\n${structuralUndo.trim()}\n`;
    const report = {
      generated_at: at,
      clone_audit_id: cloneId,
      pny01_version: Number(pny01.version),
      pnys_version_before: Number(pnys.version),
      pnys_version_after: newVersion,
      source_metrics: sourceMetrics,
      target_metrics: targetMetrics,
      source_checksum: sourceChecksum,
      target_checksum: targetChecksum,
      balances_unchanged: stable(pnys.doc.balances) === stable(targetState.balances),
      old_doc_sha256: oldDocChecksum,
      new_doc_sha256: newDocChecksum,
      source_resolution: sourceResolution.sources,
      target_resolution: targetResolution.sources,
    };

    await mkdir(outputDir, { recursive: true });
    const stamp = at.replace(/[:.]/g, "-");
    const paths = {
      backup: path.join(outputDir, `pnys-pre-rls-reconciliation-${stamp}.json`),
      feed: path.join(outputDir, `pny01-customer-catalog-${stamp}.json`),
      menu: path.join(outputDir, `pny01-till-menu-${stamp}.json`),
      flowers: path.join(outputDir, `pny01-flowers-raw-${stamp}.csv`),
      items: path.join(outputDir, `pny01-items-raw-${stamp}.csv`),
      repair: path.join(outputDir, `pnys-rls-reconciliation-${stamp}.sql`),
      undo: path.join(outputDir, `pnys-rls-reconciliation-${stamp}.undo.sql`),
      report: path.join(outputDir, `pnys-rls-reconciliation-${stamp}.report.json`),
    };
    await Promise.all([
      writeFile(paths.backup, `${JSON.stringify({ ...pnys, doc_sha256: oldDocChecksum }, null, 2)}\n`, { flag: "wx", mode: 0o600 }),
      writeFile(paths.feed, feedText, { flag: "wx", mode: 0o600 }),
      writeFile(paths.menu, menuText, { flag: "wx", mode: 0o600 }),
      writeFile(paths.flowers, flowerCsv, { flag: "wx", mode: 0o600 }),
      writeFile(paths.items, itemCsv, { flag: "wx", mode: 0o600 }),
      writeFile(paths.repair, repairSql, { flag: "wx", mode: 0o600 }),
      writeFile(paths.undo, runtimeUndo, { flag: "wx", mode: 0o600 }),
      writeFile(paths.report, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 }),
    ]);

    await client.query("begin");
    try {
      await client.query(stripTransaction(migration));
      const saved = await client.query(
        "update pnys_pos.live_state set doc=$1::jsonb, version=version+1, updated_at=now() where store_code='PNYS' and version=$2 returning version",
        [newDocText, Number(pnys.version)],
      );
      if (saved.rowCount !== 1) throw new Error("PNYS reconciliation version guard failed");
      await client.query(
        "insert into pnys_pos.clone_audit (clone_id, source_store, target_store, source_version, source_counts, target_counts, source_checksum, target_checksum, reconciled, audit_kind, detail) values ($1,'PNY01','PNYS',$2,$3::jsonb,$4::jsonb,$5,$6,true,'catalog_rls_reconciliation',$7::jsonb)",
        [cloneId, Number(pny01.version), JSON.stringify(sourceMetrics), JSON.stringify(targetMetrics), sourceChecksum, targetChecksum, JSON.stringify(detail)],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }

    const verified = await client.query(`
      select
        (select version from pnys_pos.live_state where store_code='PNYS') as version,
        (select count(*)::int from pg_tables where schemaname in ('pnys_pos','pos_hub')) as table_count,
        (select count(*)::int from pg_tables where schemaname in ('pnys_pos','pos_hub') and rowsecurity and forcerowsecurity) as rls_forced_count,
        (select count(*)::int from pg_policies where schemaname in ('pnys_pos','pos_hub') and policyname='pnys_app_all') as policy_count,
        has_table_privilege('pnys_app','pnys_pos.live_state','select,insert,update,delete') as app_live_state_access,
        has_table_privilege('pnys_app','pnys_pos.clone_audit','select') as app_audit_read,
        has_table_privilege('pnys_app','pnys_pos.clone_audit','insert') as app_audit_insert
    `);
    console.log(JSON.stringify({ applied: true, paths, report, security: verified.rows[0] }));
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  const secret = process.env.POS_SUPABASE_DB_URL?.trim() ?? "";
  console.error(`PNYS reconciliation failed: ${safeError(error, secret)}`);
  process.exitCode = 1;
});
