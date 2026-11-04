import flowers from "../flowers.json" with { type: "json" };
import { parseFlowerSku } from "./flowerSku.ts";
import { paperLines } from "./paperRefill.ts";
import sheetMenu from "./setbFlowerMenu.json" with { type: "json" };
import { catalogFromFeed, readCommittedPnyCatalog } from "./setbFeed.ts";

export type PriceQuote = {
  cents: number;
  source: "SETB" | "Tri standard";
  name: string;
  category: string;
  image: string | null;
};

type FlowerPack = { regular?: number | null; sale?: number | null } | null;
type FlowerRow = {
  sku?: string;
  name?: string;
  tier?: string;
  image?: string;
  price3g?: FlowerPack;
  price5g?: FlowerPack;
  price14g?: FlowerPack;
  price28g?: FlowerPack;
};

const flowerRows = flowers as FlowerRow[];

type SheetMenuRow = {
  sku: string;
  name: string;
  tier: string;
  image: string;
  price3g: number | null;
  price5g: number | null;
  price14g: number | null;
  price28g: number | null;
};

const sheetRows = sheetMenu as SheetMenuRow[];

function packCents(pack: FlowerPack) {
  if (!pack || typeof pack !== "object") return null;
  const dollars = typeof pack.sale === "number" ? pack.sale : pack.regular;
  if (typeof dollars !== "number" || !Number.isFinite(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100);
}

function seriesCategory(base: string) {
  const n = Number(base);
  if (n >= 500 && n < 600) return "EXOTIC";
  if (n >= 400 && n < 500) return "PREMIUM";
  if (n >= 300 && n < 400) return "AAA+";
  if (n >= 200 && n < 300) return "AA";
  if (n >= 100 && n < 200) return "BUDGET";
  return "Flower";
}

function standardCents(base: string, size: string, tier: string) {
  const n = Number(base);
  const label = tier.toUpperCase();
  if ((n >= 500 && n < 600) || label.includes("EXOTIC")) {
    if (size === "3g") return 4000;
    if (size === "5g") return 6000;
  }
  if ((n >= 400 && n < 500) || label === "PREMIUM") {
    if (size === "3g") return 3000;
    if (size === "5g") return 4500;
  }
  if (n >= 300 && n < 400) {
    if (size === "3g") return 2000;
    if (size === "5g") return 3000;
  }
  if (n >= 200 && n < 300) {
    if (size === "5g") return 2000;
    if (size === "14g") return 4500;
    if (size === "28g") return 7000;
  }
  if (n >= 100 && n < 200 && size === "3g") return 1000;
  return null;
}

function sheetQuote(base: string, size: string): PriceQuote | null {
  const row = sheetRows.find((item) => item.sku === base);
  if (!row) return null;
  const dollars = row[`price${size}` as "price3g"];
  if (typeof dollars !== "number" || dollars <= 0) return null;
  return {
    cents: Math.round(dollars * 100),
    source: "SETB",
    name: row.name ? `${row.name} ${size}` : `${base}-${size}`,
    category: row.tier || seriesCategory(base),
    image: row.image || null,
  };
}

export function quoteForSku(sku: string): PriceQuote | null {
  const catalog = catalogFromFeed(readCommittedPnyCatalog());
  const parsed = parseFlowerSku(sku);
  if (parsed) {
    const fromSheet = sheetQuote(parsed.base, parsed.size);
    if (fromSheet) return fromSheet;
    const onSheet = sheetRows.some((item) => item.sku === parsed.base);
    const flower = flowerRows.find((row) => String(row.sku ?? "") === parsed.base);
    const tier = sheetRows.find((item) => item.sku === parsed.base)?.tier || flower?.tier || "";
    const strain = sheetRows.find((item) => item.sku === parsed.base)?.name || flower?.name || "";
    const name = strain ? `${strain} ${parsed.size}` : sku;
    const category = tier || seriesCategory(parsed.base);
    const image = sheetRows.find((item) => item.sku === parsed.base)?.image || flower?.image || null;
    if (!onSheet) {
      const listed = catalog.find((row) => row.sku === sku && row.price_cents > 0);
      if (listed) return { cents: listed.price_cents, source: "SETB", name: listed.name, category: listed.category, image: listed.image_url };
      const packKey = `price${parsed.size}` as "price3g" | "price5g" | "price14g" | "price28g";
      const pack = flower ? packCents(flower[packKey] ?? null) : null;
      if (pack != null) return { cents: pack, source: "SETB", name, category, image };
    }
    const standard = standardCents(parsed.base, parsed.size, tier);
    if (standard != null) return { cents: standard, source: "Tri standard", name, category, image };
    return null;
  }
  const pack = cigarettePackQuote(sku, catalog);
  if (pack) return pack;
  const listed = catalog.find((row) => row.sku === sku && row.price_cents > 0);
  if (listed) return { cents: listed.price_cents, source: "SETB", name: listed.name, category: listed.category, image: listed.image_url };
  return null;
}

/** Paper cigarette packs. Tri's price is $2.50 per pack. Test till SKUs in this range are not packs. */
const CIGARETTE_PACKS = new Set(["1000", "1002", "1005", "1006", "1008", "1010", "1011", "1012", "1013", "1014", "1015", "1016", "1017", "1018", "1019", "1026", "1027"]);

export function cigarettePackCents(sku: string, category?: string | null, name?: string | null) {
  if (/\b(marlboro|belmont)\b/i.test(name ?? "")) return 1000;
  if (!CIGARETTE_PACKS.has(sku.trim())) return null;
  if (category != null && category.trim() !== "" && !["cigarettes", "tobacco"].includes(category.trim().toLowerCase())) return null;
  return 250;
}

function cigarettePackQuote(sku: string, catalog: ReturnType<typeof catalogFromFeed>): PriceQuote | null {
  if (!CIGARETTE_PACKS.has(sku.trim())) return null;
  const listed = catalog.find((row) => row.sku === sku);
  if (listed && !["cigarettes", "tobacco"].includes(listed.category.trim().toLowerCase())) return null;
  const paper = paperLines().find((line) => line.sku === sku);
  const name = paper?.name || listed?.name || sku;
  const category = listed?.category || "CIGARETTES";
  return {
    cents: cigarettePackCents(sku, category, name) ?? 250,
    source: "Tri standard",
    name,
    category,
    image: listed?.image_url ?? null,
  };
}

export function rawPriceRows() {
  const rows: { SKU: string; Unit_Price: string; Unit: string; Source: string }[] = [];
  const seen = new Set<string>();
  for (const line of paperLines()) {
    if (seen.has(line.sku)) continue;
    const quote = quoteForSku(line.sku);
    if (!quote) continue;
    seen.add(line.sku);
    rows.push({
      SKU: line.sku,
      Unit_Price: (quote.cents / 100).toFixed(2),
      Unit: cigarettePackCents(line.sku) == null ? "bag" : "pack",
      Source: quote.source,
    });
  }
  return rows;
}
