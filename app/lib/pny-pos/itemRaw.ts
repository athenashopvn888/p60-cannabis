import { parseFlowerSku } from "./flowerSku.ts";
import { parseCsv, saleCents } from "./flowerRaw.ts";

/** Tri's SETB workbook. Read-only. Never written. */
export const SETB_SHEET_ID = "14rt5bBuyMnvG62kcw5J1dy7kvm-adM06a3UqM_BREvE";
export const SETB_ITEMS_CSV =
  `https://docs.google.com/spreadsheets/d/${SETB_SHEET_ID}/export?format=csv&gid=688068813`;

/** Dated hidden copy of Items_raw_price taken before the SETB fill. */
export const ITEMS_PRICE_BACKUP = "Items_raw_price_backup_2026-11-04";

export type ItemRecord = {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  image: string | null;
};

export type ItemIndex = Map<string, ItemRecord>;

export type ExpandedItem = {
  sku: string;
  name: string;
  category: string;
  type: string;
  thc: string;
  mg: string;
  image: string;
  status: string;
  priceEach: string;
  unitCents: number | null;
  cartonDollars: number | null;
  unit: string;
  sourceRows: number[];
  flag: string;
};

export type CombinedSkuRow = {
  sourceRow: number;
  raw: string;
  skus: string[];
  name: string;
  price: string;
};

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

const ADDED_COLUMNS = ["Name", "Category", "ImageURL", "Type", "THC", "MG", "Status", "source_row", "Price_Flag", "Price_EACH", "Carton_Price"];

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

function column(headers: string[], names: string[]) {
  const wanted = new Set(names.map(headerKey));
  return headers.findIndex((header) => wanted.has(headerKey(header)));
}

function findHeader(grid: string[][]) {
  for (let i = 0; i < Math.min(grid.length, 15); i += 1) {
    const keys = (grid[i] ?? []).map(headerKey);
    const hasPrice = keys.includes("priceeach") || keys.includes("unitprice") || keys.includes("price");
    const hasName = keys.includes("name");
    const hasSku = keys.includes("sku") || keys[0] === "s";
    if (hasPrice && hasName && hasSku) return i;
  }
  return -1;
}

function skuColumn(headers: string[]) {
  const named = column(headers, ["sku"]);
  if (named >= 0) return named;
  if (headerKey(headers[0] ?? "") === "s") return 0;
  return 0;
}

/** Split a SKU cell on commas and on short ranges such as 680-683. */
export function expandSkuCell(raw: string) {
  const skus: string[] = [];
  for (const token of raw.split(",")) {
    const text = token.trim();
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(text);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const span = Math.abs(end - start);
      if (span <= 30) {
        const step = start <= end ? 1 : -1;
        for (let n = start; step > 0 ? n <= end : n >= end; n += step) skus.push(String(n));
        continue;
      }
    }
    const sku = normalizeItemSku(text);
    if (/^\d+$/.test(sku)) skus.push(sku);
  }
  return skus;
}

function dollarAmounts(raw: string) {
  const amounts: number[] = [];
  for (const part of raw.split("/")) {
    const match = /\$?\s*(\d+(?:\.\d+)?)/.exec(part);
    if (!match) continue;
    const amount = Number(match[1]);
    if (Number.isFinite(amount) && amount > 0) amounts.push(amount);
  }
  return amounts;
}

function parsePrice(raw: string, skuCount: number) {
  const text = raw.trim();
  if (!text) return { unitCents: null as number | null, prices: [] as number[], cartonDollars: null as number | null, unit: "", flag: "missing price" };
  if (/carton/i.test(text)) {
    const amount = dollarAmounts(text)[0];
    return {
      unitCents: 250,
      prices: [250],
      cartonDollars: amount ?? null,
      unit: "pack",
      flag: "",
    };
  }
  if (/pack/i.test(text)) {
    const amount = dollarAmounts(text)[0];
    const cents = amount == null ? null : Math.round(amount * 100);
    return { unitCents: cents, prices: cents == null ? [] : [cents], cartonDollars: null, unit: "pack", flag: cents == null ? "missing pack price" : "" };
  }
  if (/\$\s*\d+(?:\.\d+)?\s*\/\s*\d+\s*cig/i.test(text)) {
    const amount = Number(/\$\s*(\d+(?:\.\d+)?)/.exec(text)?.[1]);
    const cents = Number.isFinite(amount) ? Math.round(amount * 100) : null;
    return { unitCents: cents, prices: cents == null ? [] : [cents], cartonDollars: null, unit: "each", flag: "" };
  }
  if (text.includes("|") && !text.includes("/")) {
    const cents = saleCents(text);
    return { unitCents: cents, prices: cents == null ? [] : [cents], cartonDollars: null, unit: "each", flag: "" };
  }
  const amounts = dollarAmounts(text).map((dollars) => Math.round(dollars * 100));
  if (amounts.length === 0) return { unitCents: null, prices: [], cartonDollars: null, unit: "", flag: `unparsed: ${text}` };
  if (amounts.length === 1) return { unitCents: amounts[0], prices: amounts, cartonDollars: null, unit: "each", flag: "" };
  if (amounts.length === skuCount) return { unitCents: null, prices: amounts, cartonDollars: null, unit: "each", flag: "" };
  return { unitCents: null, prices: amounts, cartonDollars: null, unit: "", flag: `ambiguous: ${text}` };
}

function uniqueRows(rows: number[]) {
  return [...new Set(rows)];
}

/** One record per SKU. Combined cells are split. A later clear price replaces an earlier ambiguous one. */
export function expandSetbItems(grid: string[][]) {
  const headerAt = findHeader(grid);
  const items = new Map<string, ExpandedItem>();
  const combined: CombinedSkuRow[] = [];
  if (headerAt < 0) return { items: [] as ExpandedItem[], combined };
  const headers = grid[headerAt] ?? [];
  const skuCol = skuColumn(headers);
  const nameCol = column(headers, ["name"]);
  const categoryCol = column(headers, ["category"]);
  const typeCol = column(headers, ["type"]);
  const thcCol = column(headers, ["thc"]);
  const mgCol = column(headers, ["mg"]);
  const priceCol = column(headers, ["priceeach", "unitprice", "price"]);
  const imageCol = column(headers, ["imageurl", "imagelink", "image", "photo"]);
  const statusCol = column(headers, ["status"]);
  for (let index = headerAt + 1; index < grid.length; index += 1) {
    const cells = grid[index] ?? [];
    const rawSku = String(cells[skuCol] ?? "");
    const skus = expandSkuCell(rawSku);
    if (skus.length === 0) continue;
    const unique = [...new Set(skus)];
    const sourceRow = index + 1;
    if (unique.length > 1 || /[,-]/.test(rawSku)) {
      combined.push({
        sourceRow,
        raw: rawSku.trim(),
        skus: unique,
        name: String(cells[nameCol] ?? "").replace(/\s+/g, " ").trim(),
        price: String(cells[priceCol] ?? "").trim(),
      });
    }
    const parsed = parsePrice(priceCol >= 0 ? String(cells[priceCol] ?? "") : "", unique.length);
    const zipped = parsed.flag === "" && parsed.prices.length === unique.length && parsed.prices.length > 1;
    unique.forEach((sku, at) => {
      const unitCents = parsed.flag.startsWith("ambiguous") || parsed.flag.startsWith("missing") || parsed.flag.startsWith("unparsed")
        ? null
        : zipped
          ? parsed.prices[at] ?? null
          : parsed.unitCents;
      const incoming: ExpandedItem = {
        sku,
        name: String(cells[nameCol] ?? "").replace(/\s+/g, " ").trim() || sku,
        category: categoryLabel(categoryCol >= 0 ? String(cells[categoryCol] ?? "") : ""),
        type: typeCol >= 0 ? String(cells[typeCol] ?? "").trim() : "",
        thc: thcCol >= 0 ? String(cells[thcCol] ?? "").trim() : "",
        mg: mgCol >= 0 ? String(cells[mgCol] ?? "").trim() : "",
        image: imageCol >= 0 && /^https?:\/\//i.test(String(cells[imageCol] ?? "").trim()) ? String(cells[imageCol]).trim() : "",
        status: statusCol >= 0 ? String(cells[statusCol] ?? "").trim() : "",
        priceEach: priceCol >= 0 ? String(cells[priceCol] ?? "").trim() : "",
        unitCents,
        cartonDollars: parsed.cartonDollars,
        unit: parsed.unit,
        sourceRows: [sourceRow],
        flag: unitCents == null ? parsed.flag : "",
      };
      const previous = items.get(sku);
      if (!previous) {
        items.set(sku, incoming);
        return;
      }
      previous.sourceRows = uniqueRows([...previous.sourceRows, ...incoming.sourceRows]);
      const previousClear = previous.unitCents != null;
      const incomingClear = incoming.unitCents != null;
      if (!previousClear && incomingClear) {
        const sources = previous.sourceRows;
        items.set(sku, { ...incoming, sourceRows: sources });
        return;
      }
      if (previousClear && !incomingClear) return;
      if (incomingClear) {
        const sources = previous.sourceRows;
        const name = incoming.name.length > previous.name.length ? incoming.name : previous.name;
        items.set(sku, { ...incoming, name, sourceRows: sources });
      } else if (incoming.name.length > previous.name.length) {
        previous.name = incoming.name;
      }
    });
  }
  return { items: [...items.values()], combined };
}

export function itemsFromGrid(grid: string[][]): ItemIndex {
  const index: ItemIndex = new Map();
  for (const item of expandSetbItems(grid).items) {
    if (item.flag || item.unitCents == null || item.unitCents <= 0) continue;
    index.set(item.sku, {
      sku: item.sku,
      name: item.name,
      category: item.category,
      price_cents: item.unitCents,
      image: item.image || null,
    });
  }
  return index;
}

function setCell(headers: string[], line: string[], name: string, value: string) {
  const at = headers.findIndex((header) => headerKey(header) === headerKey(name));
  if (at >= 0) line[at] = value;
}

/** Keep every existing column and any SKU that SETB does not list. One row per SKU. */
export function mergeItemsPriceGrid(existing: string[][], items: ExpandedItem[]) {
  const current = existing.length > 0 ? existing : [["SKU", "Unit_Price", "Unit", "Source"]];
  const oldHeaders = (current[0] ?? []).map((cell) => String(cell ?? "").trim());
  while (oldHeaders.length > 0 && oldHeaders[oldHeaders.length - 1] === "") oldHeaders.pop();
  const headers = [...oldHeaders];
  for (const name of ["SKU", "Unit_Price", "Unit", "Source", "Carton_Price", ...ADDED_COLUMNS]) {
    if (!headers.some((header) => headerKey(header) === headerKey(name))) headers.push(name);
  }
  const skuAt = headers.findIndex((header) => headerKey(header) === "sku");
  const bySku = new Map<string, string[]>();
  const order: string[] = [];
  for (const row of current.slice(1)) {
    const sku = normalizeItemSku(String(row[Math.max(0, oldHeaders.findIndex((header) => headerKey(header) === "sku"))] ?? row[0] ?? ""));
    if (!/^\d+$/.test(sku) || bySku.has(sku)) continue;
    const line = headers.map(() => "");
    oldHeaders.forEach((header, index) => {
      const at = headers.findIndex((name) => headerKey(name) === headerKey(header));
      if (at >= 0) line[at] = String(row[index] ?? "");
    });
    bySku.set(sku, line);
    order.push(sku);
  }
  for (const item of items) {
    let line = bySku.get(item.sku);
    if (!line) {
      line = headers.map(() => "");
      bySku.set(item.sku, line);
      order.push(item.sku);
    }
    setCell(headers, line, "SKU", item.sku);
    setCell(headers, line, "Name", item.name);
    setCell(headers, line, "Category", item.category);
    setCell(headers, line, "ImageURL", item.image);
    setCell(headers, line, "Type", item.type);
    setCell(headers, line, "THC", item.thc);
    setCell(headers, line, "MG", item.mg);
    setCell(headers, line, "Status", item.status);
    setCell(headers, line, "source_row", item.sourceRows.join(", "));
    setCell(headers, line, "Price_EACH", item.priceEach);
    setCell(headers, line, "Price_Flag", item.flag);
    setCell(headers, line, "Source", "SETB ITEMS_RAW");
    if (item.unitCents != null) {
      setCell(headers, line, "Unit_Price", (item.unitCents / 100).toFixed(2));
      setCell(headers, line, "Unit", item.unit || "each");
    } else {
      setCell(headers, line, "Unit_Price", "");
    }
    if (item.cartonDollars != null) setCell(headers, line, "Carton_Price", String(item.cartonDollars));
    if (/\b(marlboro|belmont)\b/i.test(item.name) && item.unitCents != null) {
      setCell(headers, line, "Unit_Price", "10.00");
      setCell(headers, line, "Unit", "pack");
    }
  }
  return [headers, ...order.map((sku) => bySku.get(sku) ?? headers.map(() => ""))].map((row) => {
    const copy = row.slice(0, headers.length);
    while (copy.length < headers.length) copy.push("");
    return copy;
  }).filter((_, index) => index === 0 || (skuAt >= 0 && String(_[skuAt] ?? "").trim() !== ""));
}

function rowCell(row: Record<string, string>, name: string) {
  const wanted = headerKey(name);
  for (const [key, value] of Object.entries(row)) {
    if (headerKey(key) === wanted) return value ?? "";
  }
  return "";
}

/** Sellable rows from Items_raw_price. Ambiguous prices are left out. */
export function itemsFromPriceSheetRows(rows: Record<string, string>[]): ItemIndex {
  const index: ItemIndex = new Map();
  for (const row of rows) {
    if (/^(ambiguous|missing|unparsed)/i.test(rowCell(row, "Price_Flag"))) continue;
    const sku = normalizeItemSku(rowCell(row, "SKU"));
    if (!/^\d+$/.test(sku) || index.has(sku)) continue;
    const cents = saleCents(rowCell(row, "Unit_Price"));
    if (cents == null) continue;
    const image = rowCell(row, "ImageURL").trim();
    index.set(sku, {
      sku,
      name: rowCell(row, "Name").replace(/\s+/g, " ").trim() || sku,
      category: categoryLabel(rowCell(row, "Category")),
      price_cents: cents,
      image: /^https?:\/\//i.test(image) ? image : null,
    });
  }
  return index;
}

export function lookupItem(index: ItemIndex | null | undefined, sku: string) {
  if (!index || index.size === 0 || parseFlowerSku(sku)) return null;
  return index.get(normalizeItemSku(sku)) ?? null;
}

export async function fetchSetbItemGrid() {
  const response = await fetch(SETB_ITEMS_CSV, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`SETB items ${response.status}`);
  return parseCsv(await response.text());
}

type PriceSheet = {
  readGrid(tab: string): Promise<string[][]>;
  listTitles(): Promise<string[]>;
  copyTabHidden(from: string, to: string): Promise<void>;
  writeExactGrid(tab: string, grid: string[][]): Promise<void>;
};

/** Back up Items_raw_price, then fill one expanded SETB row per SKU. Does not write SETB. */
export async function syncItemsRawPrice(sheet: PriceSheet) {
  const existing = await sheet.readGrid("Items_raw_price");
  const titles = await sheet.listTitles();
  if (!titles.includes(ITEMS_PRICE_BACKUP)) await sheet.copyTabHidden("Items_raw_price", ITEMS_PRICE_BACKUP);
  const setb = expandSetbItems(await fetchSetbItemGrid());
  const merged = mergeItemsPriceGrid(existing, setb.items);
  await sheet.writeExactGrid("Items_raw_price", merged);
  return {
    backup: ITEMS_PRICE_BACKUP,
    rows: merged.length - 1,
    setbSkus: setb.items.length,
    flagged: setb.items.filter((item) => item.flag).map((item) => ({ sku: item.sku, name: item.name, flag: item.flag, source: item.sourceRows.join(", ") })),
    combined: setb.combined,
  };
}
