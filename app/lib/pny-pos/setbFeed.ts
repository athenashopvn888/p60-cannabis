import flowers from "../flowers.json" with { type: "json" };
import items from "../items.json" with { type: "json" };

/** Same Apps Script as app/lib/tvStock.js. Read-only product master for PNY01. On-hand is never read. */
export const DEFAULT_SETB_PRODUCTS_URL =
  "https://script.google.com/macros/s/AKfycbx09_sDal1eMVF1r-hUck4e7oq_XBHEWhGvA79JuhZNQ6P4CdhCas0xE3FfexWQ3hq4/exec?store=PNY01";

const STOCK_KEYS = new Set(["on_hand", "onhand", "onHand", "qty", "quantity", "stock", "balance", "inventory", "in_stock", "inStock"]);

export type SetbProduct = {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  image_url: string | null;
  active: boolean;
};

type PackPrice = { regular?: number | null; sale?: number | null } | null;

export function defaultSetbProductsUrl() {
  const configured = process.env.SETB_PRODUCTS_URL?.trim();
  return configured || DEFAULT_SETB_PRODUCTS_URL;
}

export function readCommittedPnyCatalog(): { flowers: unknown[]; items: unknown[] } {
  return { flowers: flowers as unknown[], items: items as unknown[] };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function imageOf(row: Record<string, unknown>) {
  const image = text(row.image_url) || text(row.image);
  return image || null;
}

function dollarsToCents(value: unknown) {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function packPriceCents(pack: unknown) {
  if (!pack || typeof pack !== "object") return null;
  const row = pack as PackPrice;
  const sale = typeof row.sale === "number" ? row.sale : null;
  const regular = typeof row.regular === "number" ? row.regular : null;
  const dollars = sale ?? regular;
  if (dollars == null || !Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function splitSkus(raw: unknown) {
  return text(raw).split(",").map((sku) => sku.trim()).filter(Boolean);
}

function splitPrices(raw: unknown) {
  return String(raw ?? "")
    .split("/")
    .map((part) => dollarsToCents(part))
    .filter((price): price is number => price != null);
}

function withoutStock(row: Record<string, unknown>) {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!STOCK_KEYS.has(key)) copy[key] = value;
  }
  return copy;
}

function fromFlower(row: Record<string, unknown>): SetbProduct[] {
  const sku = text(row.sku);
  if (!sku) return [];
  const name = text(row.name) || sku;
  const category = text(row.tier) || text(row.category) || "Flower";
  const image = imageOf(row);
  const active = row.active !== false && row.setb_active !== false;
  const packs: [string, unknown][] = [
    ["3g", row.price3g],
    ["5g", row.price5g],
    ["14g", row.price14g],
    ["28g", row.price28g],
  ];
  const products: SetbProduct[] = [];
  for (const [size, pack] of packs) {
    const price = packPriceCents(pack);
    if (price == null) continue;
    products.push({
      sku: `${sku}-${size}`,
      name: `${name} ${size}`,
      category,
      price_cents: price,
      image_url: image,
      active,
    });
  }
  return products;
}

function fromItem(row: Record<string, unknown>): SetbProduct[] {
  const skus = splitSkus(row.sku);
  if (skus.length === 0) return [];
  const prices = splitPrices(row.price);
  return skus.map((sku, index) => ({
    sku,
    name: text(row.name) || sku,
    category: text(row.category) || "Uncategorized",
    price_cents: prices.length === skus.length ? prices[index] : prices[0] ?? 0,
    image_url: imageOf(row),
    active: row.active !== false && row.setb_active !== false,
  }));
}

function fromLoose(row: Record<string, unknown>): SetbProduct[] {
  if (row.price3g || row.price5g || row.price14g || row.price28g || row.tier) return fromFlower(row);
  if (typeof row.price === "string" || String(row.sku ?? "").includes(",")) return fromItem(row);
  const sku = text(row.sku);
  if (!sku) return [];
  let price = 0;
  if (typeof row.price_cents === "number") price = Math.round(row.price_cents);
  else if (typeof row.default_price_cents === "number") price = Math.round(row.default_price_cents);
  else if (typeof row.price === "number") price = Math.round(row.price * 100);
  return [{
    sku,
    name: text(row.name) || sku,
    category: text(row.category) || "Uncategorized",
    price_cents: price,
    image_url: imageOf(row),
    active: row.active !== false && row.setb_active !== false,
  }];
}

/** Map a SETB product payload. Stock fields are dropped and never returned. */
export function catalogFromFeed(payload: unknown): SetbProduct[] {
  const rows = rowsOf(payload).map(withoutStock);
  const products = rows.flatMap(fromLoose);
  const seen = new Set<string>();
  const unique: SetbProduct[] = [];
  for (const product of products) {
    if (seen.has(product.sku)) continue;
    seen.add(product.sku);
    unique.push(product);
  }
  return unique;
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  if (Array.isArray(body.products)) return rowsOf(body.products);
  return [
    ...(Array.isArray(body.flowers) ? body.flowers : []),
    ...(Array.isArray(body.items) ? body.items : []),
  ].filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}
