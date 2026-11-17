import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import { flowersFromGrid, parseCsv, PUBLISHED_FLOWER_CSV } from "../app/lib/pny-pos/flowerRaw.ts";
import { itemsFromGrid, SETB_ITEMS_CSV } from "../app/lib/pny-pos/itemRaw.ts";
import { catalogFromFeed, defaultSetbProductsUrl } from "../app/lib/pny-pos/setbFeed.ts";
import { reconcileTillCatalog, type TillMenuItem } from "../app/lib/pny-pos/tillCatalog.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

type Json = Record<string, unknown>;

const PNY01_MENU_URL = "https://pny1-pos.vercel.app/api/menu";
const EXPECTED_PNYS_VERSION = 5;
const EXPECTED_PNYS_DOC_SHA256 = "80e85abb708c7aa17073753c5abcdd0de8bf73423bfb39c9cf4a77bc8f5a229b";
const PNYS_UPDATED_AT = "2026-11-13 11:38:16.215348+00";

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

function csvDoc(text: string, label: string): State {
  const rows = parseCsv(text);
  if (rows.length !== 2 || rows[0][0]?.trim() !== "doc" || !rows[1][0]) {
    throw new Error(`${label} must be a one-row Supabase CSV export with a doc column`);
  }
  return JSON.parse(rows[1][0]) as State;
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

function stripTransaction(sql: string) {
  return sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "");
}

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Source returned ${response.status}: ${url}`);
  return response.text();
}

function spotChecks(state: State) {
  const wanted = ["240", "396-3g", "406-5g", "419-3g", "715", "1010", "204-5g", "340-5g", "721", "969"];
  const products = new Map(state.products.map((row) => [row.sku, row]));
  const stores = new Map(state.store_products.filter((row) => row.store_code === "PNYS").map((row) => [row.sku, row]));
  const balances = new Map(state.balances.filter((row) => (row.store_code ?? "PNYS") === "PNYS").map((row) => [row.sku, row.qty]));
  return wanted.map((sku) => ({ sku, product: products.get(sku) ?? null, store_product: stores.get(sku) ?? null, on_hand: balances.get(sku) ?? 0 }));
}

async function main() {
  const [pnysCsvPath, pny01CsvPath, outputArg] = process.argv.slice(2);
  if (!pnysCsvPath || !pny01CsvPath) throw new Error("Usage: prepare-pnys-reconciliation.ts <pnys.csv> <pny01.csv> [output-dir]");
  const outputDir = path.resolve(outputArg || "backups/pnys-foundation");
  const [pnysCsv, pny01Csv, migration, structuralUndo] = await Promise.all([
    readFile(path.resolve(pnysCsvPath), "utf8"),
    readFile(path.resolve(pny01CsvPath), "utf8"),
    readFile(new URL("../supabase/migrations/20261113193000_pnys_catalog_rls_reconciliation.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/undo/20261113193000_pnys_catalog_rls_reconciliation.undo.sql", import.meta.url), "utf8"),
  ]);
  if (/\b(insert|update|delete|alter|drop|truncate)\s+(into\s+|table\s+)?pny_pos\b/i.test(migration)) {
    throw new Error("Safety check refused a migration that writes to pny_pos");
  }
  const pnysOriginal = csvDoc(pnysCsv, "PNYS snapshot");
  const pny01Original = csvDoc(pny01Csv, "PNY01 snapshot");
  const [feedText, menuText, flowerCsv, itemCsv] = await Promise.all([
    fetchText(defaultSetbProductsUrl()),
    fetchText(PNY01_MENU_URL),
    fetchText(PUBLISHED_FLOWER_CSV),
    fetchText(SETB_ITEMS_CSV),
  ]);
  const feed = catalogFromFeed(JSON.parse(feedText));
  const menuPayload = JSON.parse(menuText) as { ok?: boolean; store?: string; items?: TillMenuItem[] };
  if (!menuPayload.ok || menuPayload.store !== "PNY01" || !Array.isArray(menuPayload.items)) throw new Error("Invalid PNY01 menu payload");
  const flowers = flowersFromGrid(parseCsv(flowerCsv));
  const items = itemsFromGrid(parseCsv(itemCsv));
  if (feed.length < 200 || flowers.size < 200 || items.size < 150) throw new Error("A catalog source is unexpectedly small");

  const at = new Date().toISOString();
  const sourceState = structuredClone(pny01Original);
  const targetState = structuredClone(pnysOriginal);
  materializeCatalog(sourceState, feed, "PNY01", at);
  materializeCatalog(targetState, feed, "PNYS", at);
  const sourceResolution = reconcileTillCatalog(sourceState, "PNY01", at, { flowers, items, menu: menuPayload.items });
  const targetResolution = reconcileTillCatalog(targetState, "PNYS", at, { flowers, items, menu: menuPayload.items });
  const store = targetState.stores.find((row) => row.code === "PNYS");
  if (!store) throw new Error("PNYS store row is missing");
  store.prices_tax_included = true;

  const sourceMetrics = metrics(sourceState, "PNY01");
  const targetMetrics = metrics(targetState, "PNYS");
  if (targetMetrics.missing_catalog_skus.length !== 0) throw new Error("Balance SKUs still lack catalog rows");
  if (sourceMetrics.catalog_count !== targetMetrics.catalog_count) throw new Error("PNY01 and PNYS catalog counts differ");
  const sourceChecksum = checksum(catalogView(sourceState, "PNY01"));
  const targetChecksum = checksum(catalogView(targetState, "PNYS"));
  if (sourceChecksum !== targetChecksum) throw new Error("PNY01 and PNYS catalog checksums differ");

  const oldDocText = JSON.stringify(pnysOriginal);
  const newDocText = JSON.stringify(targetState);
  const newDocChecksum = checksum(newDocText);
  const cloneId = randomUUID();
  const detail = {
    corrected_at: at,
    source_urls: { customer_catalog: defaultSetbProductsUrl(), pny01_till_menu: PNY01_MENU_URL, flowers_raw: PUBLISHED_FLOWER_CSV, items_raw_price_source: SETB_ITEMS_CSV },
    source_sha256: { customer_catalog: checksum(feedText), pny01_till_menu: checksum(menuText), flowers_raw: checksum(flowerCsv), items_raw_price_source: checksum(itemCsv) },
    source_resolution: sourceResolution.sources,
    target_resolution: targetResolution.sources,
    target_source_by_sku: targetResolution.sourceBySku,
    prices_tax_included: true,
    rls: "enabled_and_forced_deny_by_default_pnys_app_only",
    source_metrics: sourceMetrics,
    target_metrics: targetMetrics,
  };
  const repairSql = `-- Generated from fresh read-only PNYS and PNY01 snapshots.\n-- The transaction writes only pnys_pos and pos_hub.\nbegin;\n${stripTransaction(migration)}\n\ndo $guard$\ndeclare changed integer;\nbegin\n  update pnys_pos.live_state\n  set doc = ${sqlText(newDocText)}::jsonb, version = version + 1, updated_at = now()\n  where store_code = 'PNYS'\n    and version = ${EXPECTED_PNYS_VERSION}\n    and encode(digest(doc::text, 'sha256'), 'hex') = ${sqlText(EXPECTED_PNYS_DOC_SHA256)};\n  get diagnostics changed = row_count;\n  if changed <> 1 then raise exception 'PNYS reconciliation version/checksum guard failed'; end if;\nend $guard$;\ninsert into pnys_pos.clone_audit (clone_id, source_store, target_store, source_version, source_counts, target_counts, source_checksum, target_checksum, reconciled, audit_kind, detail)\nvalues (${sqlText(cloneId)}::uuid, 'PNY01', 'PNYS', 66575, ${sqlText(JSON.stringify(sourceMetrics))}::jsonb, ${sqlText(JSON.stringify(targetMetrics))}::jsonb, ${sqlText(sourceChecksum)}, ${sqlText(targetChecksum)}, true, 'catalog_rls_reconciliation', ${sqlText(JSON.stringify(detail))}::jsonb);\ncommit;\n`;
  if (/\b(insert|update|delete|alter|drop|truncate)\s+(into\s+|table\s+)?pny_pos\b/i.test(repairSql)) throw new Error("Generated SQL would write pny_pos");
  const undoSql = `-- Exact rollback for this generated reconciliation. Never writes pny_pos.\nbegin;\ndo $undo$\ndeclare changed integer;\nbegin\n  update pnys_pos.live_state\n  set doc = ${sqlText(oldDocText)}::jsonb, version = ${EXPECTED_PNYS_VERSION}, updated_at = ${sqlText(PNYS_UPDATED_AT)}::timestamptz\n  where store_code = 'PNYS'\n    and version = ${EXPECTED_PNYS_VERSION + 1}\n    and encode(digest(doc::text, 'sha256'), 'hex') = ${sqlText(newDocChecksum)};\n  get diagnostics changed = row_count;\n  if changed <> 1 then raise exception 'PNYS reconciliation undo guard failed'; end if;\n  delete from pnys_pos.clone_audit where clone_id = ${sqlText(cloneId)}::uuid;\nend $undo$;\ncommit;\n\n${structuralUndo.trim()}\n`;
  const report = { generated_at: at, clone_audit_id: cloneId, pnys_version_before: EXPECTED_PNYS_VERSION, pnys_version_after: EXPECTED_PNYS_VERSION + 1, pny01_source_version: 66575, source_metrics: sourceMetrics, target_metrics: targetMetrics, source_checksum: sourceChecksum, target_checksum: targetChecksum, balances_unchanged: stable(pnysOriginal.balances) === stable(targetState.balances), expected_pnys_doc_sha256: EXPECTED_PNYS_DOC_SHA256, new_doc_sha256: newDocChecksum, source_resolution: sourceResolution.sources, target_resolution: targetResolution.sources, spot_checks: spotChecks(targetState) };

  await mkdir(outputDir, { recursive: true });
  const stamp = at.replace(/[:.]/g, "-");
  const paths = {
    backup: path.join(outputDir, `pnys-pre-rls-reconciliation-${stamp}.json`),
    pny01: path.join(outputDir, `pny01-source-${stamp}.json`),
    feed: path.join(outputDir, `pny01-customer-catalog-${stamp}.json`),
    menu: path.join(outputDir, `pny01-till-menu-${stamp}.json`),
    flowers: path.join(outputDir, `pny01-flowers-raw-${stamp}.csv`),
    items: path.join(outputDir, `pny01-items-raw-${stamp}.csv`),
    repair: path.join(outputDir, `pnys-rls-reconciliation-${stamp}.sql`),
    undo: path.join(outputDir, `pnys-rls-reconciliation-${stamp}.undo.sql`),
    report: path.join(outputDir, `pnys-rls-reconciliation-${stamp}.report.json`),
  };
  await Promise.all([
    writeFile(paths.backup, `${JSON.stringify(pnysOriginal, null, 2)}\n`, { flag: "wx" }),
    writeFile(paths.pny01, `${JSON.stringify(pny01Original)}\n`, { flag: "wx" }),
    writeFile(paths.feed, feedText, { flag: "wx" }),
    writeFile(paths.menu, menuText, { flag: "wx" }),
    writeFile(paths.flowers, flowerCsv, { flag: "wx" }),
    writeFile(paths.items, itemCsv, { flag: "wx" }),
    writeFile(paths.repair, repairSql, { flag: "wx" }),
    writeFile(paths.undo, undoSql, { flag: "wx" }),
    writeFile(paths.report, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" }),
  ]);
  console.log(JSON.stringify({ prepared: true, paths, report }));
}

void main().catch((error) => {
  console.error(`PNYS reconciliation preparation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
