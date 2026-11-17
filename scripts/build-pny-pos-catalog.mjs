import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";

const [flowersArg, itemsArg, outputArg = "app/lib/pny-pos/pnyCatalog.json"] = process.argv.slice(2);
if (!flowersArg || !itemsArg) {
  throw new Error("Usage: node scripts/build-pny-pos-catalog.mjs <FLOWERS_RAW.csv> <ITEMS_RAW.csv> [output.json]");
}

function rows(path) {
  const parsed = Papa.parse(readFileSync(resolve(path), "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${path}: ${parsed.errors[0].message}`);
  return parsed.data;
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanFlowerName(value) {
  return clean(value)
    .replace(/\s*\((?:AAA\+\s*)?(?:ON\s+)?SALE!?\)\s*/gi, " ")
    .replace(/\s+(?:ON\s+)?SALE!?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A pipe means regular|sale. The active price is always the value after the pipe. */
export function activeDollars(value) {
  const raw = clean(value);
  if (!raw || raw === "-" || /^n\/?a$/i.test(raw)) return null;
  const active = raw.includes("|") ? raw.split("|").at(-1) : raw;
  const match = clean(active).replaceAll(",", "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function cents(value) {
  const amount = activeDollars(value);
  return amount == null ? null : Math.round(amount * 100);
}

function active(row) {
  return clean(row.Status).toUpperCase() === "ACTIVE";
}

function image(row) {
  const value = clean(row.ImageURL);
  return /^https?:\/\//i.test(value) ? value : null;
}

function flowerProducts(input) {
  const sizes = [["3g", "Price_3G"], ["5g", "Price_5G"], ["14g", "Price_14G"], ["28g", "Price_28G"]];
  return input.flatMap((row) => {
    const base = clean(row.SKU).replace(/\.0$/, "");
    if (!/^\d+$/.test(base)) return [];
    const name = cleanFlowerName(row.Strain) || base;
    const category = clean(row.Tier) || "Flower";
    return sizes.flatMap(([size, column]) => {
      const price = cents(row[column]);
      if (price == null) return [];
      return [{
        sku: `${base}-${size}`,
        name: `${name} ${size}`,
        category,
        price_cents: price,
        image_url: image(row),
        active: active(row),
      }];
    });
  });
}

function itemProducts(input) {
  const cigarettePacks = new Set(["1000", "1002", "1005", "1006", "1008", "1010", "1011", "1012", "1013", "1014", "1015", "1016", "1017", "1018", "1019"]);
  return input.flatMap((row) => {
    const skus = clean(row.S).split(",").map((sku) => sku.trim().replace(/\.0$/, "")).filter((sku) => /^\d+$/.test(sku));
    if (!skus.length) return [];
    const parts = clean(row.Price_EACH).split("/").map(cents).filter((price) => price != null);
    return skus.map((sku, index) => ({
      sku,
      name: clean(row.Name) || sku,
      category: clean(row.Category).toUpperCase() || "UNCATEGORIZED",
      // ITEMS_RAW carries carton values for these cigarette rows. The till
      // sells/counts individual packs at $2.50 and keeps Marlboro/Belmont at
      // their established $10 pack price outside this set.
      price_cents: cigarettePacks.has(sku) ? 250 : parts.length === skus.length ? parts[index] : parts[0] ?? 0,
      image_url: image(row),
      active: active(row),
    }));
  });
}

const all = [...flowerProducts(rows(flowersArg)), ...itemProducts(rows(itemsArg))];
const unique = new Map();
for (const product of all) {
  if (!unique.has(product.sku)) unique.set(product.sku, product);
}
const products = [...unique.values()].sort((a, b) => a.sku.localeCompare(b.sku, "en", { numeric: true }));
writeFileSync(resolve(outputArg), `${JSON.stringify(products, null, 2)}\n`, "utf8");
console.log(`PNY catalog: ${products.length} unique SKUs (${products.filter((row) => row.active).length} active) -> ${outputArg}`);
