import { readFile } from "node:fs/promises";
import Papa from "papaparse";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import { catalogFromFeed } from "../app/lib/pny-pos/setbFeed.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

type BackupRow = { store_code: string; version: string; updated_at: string; doc: string; sha256: string };

async function readState(csvPath: string) {
  const parsed = Papa.parse<BackupRow>(await readFile(csvPath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.data.length !== 1) throw new Error(`Expected one row in ${csvPath}`);
  return { row: parsed.data[0], state: JSON.parse(parsed.data[0].doc) as State };
}

function metrics(state: State, storeCode: string) {
  const products = new Map(state.products.map((row) => [row.sku, row]));
  const storeProducts = new Map(state.store_products.filter((row) => row.store_code === storeCode).map((row) => [row.sku, row]));
  const balances = state.balances.filter((row) => (row.store_code ?? storeCode) === storeCode);
  return {
    sku_count: state.products.length,
    on_hand_units: balances.reduce((sum, row) => sum + row.qty, 0),
    stock_value_cents: balances.reduce((sum, row) => {
      const product = products.get(row.sku);
      if (!product) return sum;
      return sum + row.qty * (storeProducts.get(row.sku)?.price_override_cents ?? product.default_price_cents);
    }, 0),
    thc_flagged_sku_count: state.products.filter((row) => row.thc_flag === true).length,
  };
}

function spot(state: State, storeCode: string, sku: string) {
  const product = state.products.find((row) => row.sku === sku);
  const storeProduct = state.store_products.find((row) => row.store_code === storeCode && row.sku === sku);
  const balance = state.balances.find((row) => (row.store_code ?? storeCode) === storeCode && row.sku === sku);
  return {
    qty: balance?.qty ?? null,
    name: product?.name ?? null,
    category: product?.category ?? null,
    price_cents: product ? (storeProduct?.price_override_cents ?? product.default_price_cents) : null,
    thc: product?.thc_flag ?? null,
    cataloged: Boolean(product),
  };
}

const [pnyCsv, pnysCsv, feedJson] = process.argv.slice(2);
if (!pnyCsv || !pnysCsv || !feedJson) throw new Error("Usage: audit-pnys-clone.ts <pny01.csv> <pnys.csv> <feed.json>");
const pny = await readState(pnyCsv);
const pnys = await readState(pnysCsv);
const feed = catalogFromFeed(JSON.parse(await readFile(feedJson, "utf8")));
const at = new Date().toISOString();
materializeCatalog(pny.state, feed, "PNY01", at);
materializeCatalog(pnys.state, feed, "PNYS", at);
const skus = ["240", "396-3g", "406-5g", "419-3g", "715", "188", "203-5g", "328-3g", "1000", "406-3g"];

console.log(JSON.stringify({
  pny01_snapshot: { version: Number(pny.row.version), updated_at: pny.row.updated_at },
  pnys_snapshot: { version: Number(pnys.row.version), updated_at: pnys.row.updated_at },
  effective_feed_products: feed.length,
  comparison: { PNY01: metrics(pny.state, "PNY01"), PNYS: metrics(pnys.state, "PNYS") },
  spot_checks: skus.map((sku) => ({ sku, PNY01: spot(pny.state, "PNY01", sku), PNYS: spot(pnys.state, "PNYS", sku) })),
}, null, 2));

