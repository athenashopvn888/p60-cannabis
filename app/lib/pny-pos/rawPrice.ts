import type { SheetRow } from "./types.ts";

/** How long a server keeps the Items_raw_price read. Prices change rarely; the sheet is not written. */
export const RAW_PRICE_TTL_MS = 2 * 60 * 1000;

function headerKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function cell(row: SheetRow, name: string) {
  const wanted = headerKey(name);
  for (const [key, value] of Object.entries(row)) {
    if (headerKey(key) === wanted) return value ?? "";
  }
  return "";
}

/** Blank, zero, and non-numbers are not a filled unit price. */
export function unitPriceCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || /^n\/?a$/i.test(trimmed)) return null;
  const amount = Number(trimmed.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function skuKey(raw: string) {
  return raw.trim().replace(/\.0$/, "");
}

/** One cents price per SKU from Items_raw_price.Unit_Price. Empty cells are omitted so the menu price remains. */
export function unitPricesFromRawRows(rows: SheetRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const sku = skuKey(cell(row, "SKU"));
    if (!sku) continue;
    const cents = unitPriceCents(cell(row, "Unit_Price"));
    if (cents == null || map.has(sku)) continue;
    map.set(sku, cents);
  }
  return map;
}
