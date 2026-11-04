import { parseFlowerSku } from "./flowerSku.ts";

/** Published SETB flower table. The spreadsheet has FLOWERS_LIVE, with the Flowers_Raw columns. Read-only. */
export const PUBLISHED_FLOWER_CSV =
  "https://docs.google.com/spreadsheets/d/1ECyzLymF6-aZn30Lt_BTzvXvXZr6LlEPHVixiv3McbQ/export?format=csv&gid=0";

export const FLOWER_MIRROR_TAB = "Flowers_Raw";

const SIZES = ["3g", "5g", "14g", "28g"] as const;
type Size = (typeof SIZES)[number];

export type FlowerRecord = {
  sku: string;
  strain: string;
  tier: string;
  type: string;
  thc: string;
  image: string | null;
  prices: Partial<Record<Size, number>>;
};

export type FlowerIndex = Map<string, FlowerRecord>;

type FlowerView = {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  image_url?: string | null;
  flower_type?: string;
  thc?: string;
};

function headerKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "");
}

/** Base flower number. Sized SKUs lose only the size suffix. 9500 stays 9500. */
export function flowerBaseSku(sku: string) {
  const trimmed = sku.trim().replace(/\.0$/, "");
  return parseFlowerSku(trimmed)?.base ?? trimmed;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "40|30" charges 30. A blank cell is not a price. */
export function saleCents(raw: string) {
  const text = raw.trim().replace(/\$/g, "").replace(/,/g, "");
  if (!text || text === "-" || /^n\/a$/i.test(text) || /^none$/i.test(text)) return null;
  const token = (text.includes("|") ? text.split("|")[1] : text).trim();
  const amount = Number(token);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function normalizeThc(raw: string) {
  const text = raw.trim();
  if (!text || text === "-" || /^none$/i.test(text)) return "";
  const amount = Number(text.replace(/%/g, "").trim());
  if (!Number.isFinite(amount)) return "";
  const pct = amount > 0 && amount < 1 ? Math.round(amount * 100) : Math.round(amount);
  return `${pct}%`;
}

function cleanStrain(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\(?\s*AAA\+?\s*ON\s*SALE\s*\)?\s*$/i, "")
    .replace(/\s*\(?\s*AAA\+?\s*SALE!?\s*\)?\s*$/i, "")
    .replace(/\s*\bON\s*SALE\s*$/i, "")
    .replace(/\s*\bSALE!?\s*$/i, "")
    .trim();
}

function tierLabel(raw: string) {
  const value = raw.trim().toUpperCase();
  if (value === "AAA" || value === "AAA+") return "AAA+";
  if (value === "EXOTIC" || value === "PREMIUM" || value === "AA" || value === "BUDGET") return value;
  return "";
}

function cleanType(raw: string) {
  return raw.trim().toUpperCase().replace(/\b(SALE|HOT)\b/g, "").replace(/\s+/g, " ").trim();
}

function column(headers: string[], names: string[]) {
  const wanted = new Set(names.map(headerKey));
  return headers.findIndex((header) => wanted.has(headerKey(header)));
}

function priceColumn(headers: string[], size: Size) {
  const wanted = headerKey(`price${size}`);
  return headers.findIndex((header) => headerKey(header) === wanted || headerKey(header) === headerKey(`price_${size}`));
}

export function flowersFromGrid(grid: string[][]): FlowerIndex {
  const index: FlowerIndex = new Map();
  let headerAt = -1;
  for (let i = 0; i < Math.min(grid.length, 30); i += 1) {
    const keys = (grid[i] ?? []).map(headerKey);
    if (keys.includes("sku") && keys.some((key) => key.startsWith("strain"))) {
      headerAt = i;
      break;
    }
  }
  if (headerAt < 0) return index;
  const headers = grid[headerAt] ?? [];
  const skuCol = column(headers, ["sku"]);
  const strainCol = column(headers, ["strain", "strainname"]);
  const tierCol = column(headers, ["tier"]);
  const typeCol = column(headers, ["type"]);
  const thcCol = column(headers, ["thc"]);
  const imageCol = column(headers, ["imageurl", "imagelink", "image", "photo"]);
  const priceCols = Object.fromEntries(SIZES.map((size) => [size, priceColumn(headers, size)])) as Record<Size, number>;
  for (const cells of grid.slice(headerAt + 1)) {
    const sku = flowerBaseSku(String(cells[skuCol] ?? ""));
    if (!sku || !/^\d+$/.test(sku)) continue;
    const strain = cleanStrain(String(cells[strainCol] ?? ""));
    const record: FlowerRecord = {
      sku,
      strain,
      tier: tierLabel(tierCol >= 0 ? String(cells[tierCol] ?? "") : ""),
      type: cleanType(typeCol >= 0 ? String(cells[typeCol] ?? "") : ""),
      thc: normalizeThc(thcCol >= 0 ? String(cells[thcCol] ?? "") : ""),
      image: imageCol >= 0 && /^https?:\/\//i.test(String(cells[imageCol] ?? "").trim()) ? String(cells[imageCol]).trim() : null,
      prices: {},
    };
    for (const size of SIZES) {
      const at = priceCols[size];
      if (at < 0) continue;
      const cents = saleCents(String(cells[at] ?? ""));
      if (cents != null) record.prices[size] = cents;
    }
    const existing = index.get(sku);
    if (!existing || (record.tier === "BUDGET" && existing.tier !== "BUDGET")) index.set(sku, record);
  }
  return index;
}

export function flowerPriceCents(index: FlowerIndex | null | undefined, sku: string) {
  if (!index || index.size === 0) return null;
  const parsed = parseFlowerSku(sku);
  if (!parsed) return null;
  const cents = index.get(parsed.base)?.prices[parsed.size as Size];
  return cents ?? null;
}

export function overlayFlower<T extends FlowerView>(item: T, index: FlowerIndex | null | undefined): T {
  if (!index || index.size === 0) return item;
  const parsed = parseFlowerSku(item.sku);
  const record = index.get(parsed?.base ?? flowerBaseSku(item.sku));
  if (!record) return item;
  const next: T = { ...item };
  if (record.strain) next.name = parsed ? `${record.strain} ${parsed.size}` : record.strain;
  if (record.tier) next.category = record.tier;
  if (record.image) next.image_url = record.image;
  if (parsed) {
    const cents = record.prices[parsed.size as Size];
    if (cents != null) next.price_cents = cents;
  }
  if (record.type) next.flower_type = record.type;
  if (record.thc) next.thc = record.thc;
  return next;
}

export async function fetchPublishedFlowerGrid() {
  const response = await fetch(PUBLISHED_FLOWER_CSV, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Flower sheet ${response.status}`);
  return parseCsv(await response.text());
}
