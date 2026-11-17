import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { catalogFromFeed } from "../app/lib/pny-pos/setbFeed.ts";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

type BackupRow = {
  store_code: string;
  version: string;
  updated_at: string;
  doc: string;
  sha256: string;
};

function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function metrics(state: State, storeCode: string) {
  const products = new Map(state.products.map((row) => [row.sku, row]));
  const storeProducts = new Map(
    state.store_products.filter((row) => row.store_code === storeCode).map((row) => [row.sku, row]),
  );
  let units = 0;
  let stockValueCents = 0;
  let unpricedBalanceSkus = 0;
  for (const balance of state.balances.filter((row) => (row.store_code ?? storeCode) === storeCode)) {
    units += balance.qty;
    const product = products.get(balance.sku);
    if (!product) {
      unpricedBalanceSkus += 1;
      continue;
    }
    const price = storeProducts.get(balance.sku)?.price_override_cents ?? product.default_price_cents;
    stockValueCents += balance.qty * price;
  }
  return {
    sku_count: state.products.length,
    balance_sku_count: state.balances.filter((row) => (row.store_code ?? storeCode) === storeCode).length,
    on_hand_units: units,
    stock_value_cents: stockValueCents,
    thc_flagged_sku_count: state.products.filter((row) => row.thc_flag === true).length,
    unpriced_balance_skus: unpricedBalanceSkus,
  };
}

const [backupPath, feedPath, outputDir] = process.argv.slice(2);
if (!backupPath || !feedPath || !outputDir) {
  throw new Error("Usage: prepare-pnys-catalog-repair.ts <backup.csv> <feed.json> <output-dir>");
}

const csv = await readFile(backupPath, "utf8");
const parsed = Papa.parse<BackupRow>(csv, { header: true, skipEmptyLines: true });
if (parsed.data.length !== 1) throw new Error("Expected exactly one valid backup row");
const row = parsed.data[0];
if (row.store_code !== "PNYS") throw new Error("Backup is not PNYS");
const oldDoc = JSON.parse(row.doc) as State;
const oldVersion = Number(row.version);
if (!Number.isSafeInteger(oldVersion)) throw new Error("Invalid backup version");
const oldDocText = JSON.stringify(oldDoc);
if (checksum(row.doc) !== row.sha256) throw new Error("Backup document checksum mismatch");

const feedPayload = JSON.parse(await readFile(feedPath, "utf8"));
const feed = catalogFromFeed(feedPayload);
if (feed.length < 200) throw new Error(`Catalog feed unexpectedly small: ${feed.length}`);
const repaired = structuredClone(oldDoc);
const at = new Date().toISOString();
materializeCatalog(repaired, feed, "PNYS", at);
const newDocText = JSON.stringify(repaired);
const newVersion = oldVersion + 1;

const repairSql = `-- PNYS catalog-only repair. Never reads or writes pny_pos.\nBEGIN;\nDO $repair$\nDECLARE changed integer;\nBEGIN\n  UPDATE pnys_pos.live_state\n  SET doc = ${sqlText(newDocText)}::jsonb, version = ${newVersion}, updated_at = now()\n  WHERE store_code = 'PNYS'\n    AND version = ${oldVersion}\n    AND encode(digest(doc::text, 'sha256'), 'hex') = ${sqlText(row.sha256)};\n  GET DIAGNOSTICS changed = ROW_COUNT;\n  IF changed <> 1 THEN RAISE EXCEPTION 'PNYS repair guard failed'; END IF;\nEND $repair$;\nCOMMIT;\n`;

const undoSql = `-- Undo PNYS catalog repair only. Restores the exact pre-repair row.\nBEGIN;\nDO $undo$\nDECLARE changed integer;\nBEGIN\n  UPDATE pnys_pos.live_state\n  SET doc = ${sqlText(oldDocText)}::jsonb, version = ${oldVersion}, updated_at = ${sqlText(row.updated_at)}::timestamptz\n  WHERE store_code = 'PNYS' AND version = ${newVersion};\n  GET DIAGNOSTICS changed = ROW_COUNT;\n  IF changed <> 1 THEN RAISE EXCEPTION 'PNYS undo guard failed'; END IF;\nEND $undo$;\nCOMMIT;\n`;

const report = {
  generated_at: at,
  source_feed_products: feed.length,
  before: metrics(oldDoc, "PNYS"),
  after: metrics(repaired, "PNYS"),
  balances_unchanged: JSON.stringify(oldDoc.balances) === JSON.stringify(repaired.balances),
  repair_doc_sha256: checksum(newDocText),
};

await mkdir(outputDir, { recursive: true });
const stamp = at.replace(/[:.]/g, "-");
const repairPath = path.join(outputDir, `pnys-catalog-repair-${stamp}.sql`);
const undoPath = path.join(outputDir, `pnys-catalog-repair-${stamp}.undo.sql`);
const reportPath = path.join(outputDir, `pnys-catalog-repair-${stamp}.report.json`);
await writeFile(repairPath, repairSql, { flag: "wx", mode: 0o600 });
await writeFile(undoPath, undoSql, { flag: "wx", mode: 0o600 });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ repairPath, undoPath, reportPath, report }));

