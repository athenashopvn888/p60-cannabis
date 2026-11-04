import { parseFlowerSku } from "./flowerSku.ts";
import { parseCsv, saleCents } from "./flowerRaw.ts";

/** Published SETB item table. That spreadsheet's item tab is ITEMS_LIVE. The PNY mirror is Items_Raw. Read-only. */
export const PUBLISHED_ITEM_CSV =
  "https://docs.google.com/spreadsheets/d/1ECyzLymF6-aZn30Lt_BTzvXvXZr6LlEPHVixiv3McbQ/export?format=csv&gid=818522385";

export const ITEM_MIRROR_TAB = "Items_Raw";

export type ItemRecord = {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  image: string | null;
};

export type ItemIndex = Map<string, ItemRecord>;

const CATEGORIES: Record<string, string> = {
  "add ons": "ADD ONS",
  addons: "ADD ONS",
  "add on": "ADD ONS",
  cigarettes: "CIGARETTES",
  cigarette: "CIGARETTES",
  tobacco: "CIGARETTES",
  edibles: "EDIBLES",
  edible: "EDIBLES",
  "vape pens": "VAPE PENS",
  "vape disposable": "VAPE DISPOSABLE",
  concentrates: "CONCENTRATES",
  prerolls: "PREROLLS",
  "magic & others": "MAGIC & OTHERS",
  budget: "BUDGET",
  aa: "AA",
  "aaa+": "AAA+",
  premium: "PREMIUM",
  exotic: "EXOTIC",
};

function headerKey(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s_]+/g, "");
}

/** "709", "709.0", and " 709 " are the same SKU. 9500 is not folded into 500. */
export function normalizeItemSku(sku: string) {
  return sku.trim().replace(/^\uFEFF/, "").replace(/\.0$/, "").replace(/\s+/g, "");
}

function categoryLabel(raw: string) {
  const key = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return CATEGORIES[key] ?? raw.trim();
}

function priceList(raw: string) {
  const text = raw.trim();
  if (!text) return [];
  if (text.includes("|") && !text.includes("/")) {
    const cents = saleCents(text);
    return cents == null ? [] : [cents];
  }
  const prices: number[] = [];
  for (const part of text.split("/")) {
    if (!/\d/.test(part)) continue;
    const cents = saleCents(part.replace(/[^0-9.|$]/g, ""));
    if (cents != null) prices.push(cents);
  }
  return prices;
}

function column(headers: string[], names: string[]) {
  const wanted = new Set(names.map(headerKey));
  return headers.findIndex((header) => wanted.has(headerKey(header)));
}

export function itemsFromGrid(grid: string[][]): ItemIndex {
  const index: ItemIndex = new Map();
  let headerAt = -1;
  for (let i = 0; i < Math.min(grid.length, 30); i += 1) {
    const keys = (grid[i] ?? []).map(headerKey);
    if (keys.includes("sku") && (keys.includes("name") || keys.some((key) => key.startsWith("price")))) {
      headerAt = i;
      break;
    }
  }
  if (headerAt < 0) return index;
  const headers = grid[headerAt] ?? [];
  const skuCol = column(headers, ["sku"]);
  const nameCol = column(headers, ["name"]);
  const categoryCol = column(headers, ["category"]);
  const priceCol = column(headers, ["priceeach", "unitprice", "price"]);
  const imageCol = column(headers, ["imageurl", "imagelink", "image", "photo"]);
  for (const cells of grid.slice(headerAt + 1)) {
    const skus = String(cells[skuCol] ?? "")
      .split(",")
      .map(normalizeItemSku)
      .filter((sku) => /^\d+$/.test(sku));
    if (skus.length === 0) continue;
    const prices = priceList(priceCol >= 0 ? String(cells[priceCol] ?? "") : "");
    if (prices.length === 0) continue;
    const name = String(cells[nameCol] ?? "").replace(/\s+/g, " ").trim();
    const category = categoryLabel(categoryCol >= 0 ? String(cells[categoryCol] ?? "") : "");
    const imageRaw = imageCol >= 0 ? String(cells[imageCol] ?? "").trim() : "";
    const image = /^https?:\/\//i.test(imageRaw) ? imageRaw : null;
    skus.forEach((sku, at) => {
      const price = prices.length === skus.length ? prices[at] : prices[0];
      if (price == null || price <= 0 || index.has(sku)) return;
      index.set(sku, { sku, name: name || sku, category, price_cents: price, image });
    });
  }
  return index;
}

export function lookupItem(index: ItemIndex | null | undefined, sku: string) {
  if (!index || index.size === 0 || parseFlowerSku(sku)) return null;
  return index.get(normalizeItemSku(sku)) ?? null;
}

export async function fetchPublishedItemGrid() {
  const response = await fetch(PUBLISHED_ITEM_CSV, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Item sheet ${response.status}`);
  return parseCsv(await response.text());
}
