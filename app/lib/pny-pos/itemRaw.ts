import { parseFlowerSku } from "./flowerSku.ts";
import { parseCsv, saleCents } from "./flowerRaw.ts";

/** Tri's SETB workbook. Read-only. Never written. */
export const SETB_SHEET_ID = "14rt5bBuyMnvG62kcw5J1dy7kvm-adM06a3UqM_BREvE";
export const SETB_ITEMS_CSV =
  `https://docs.google.com/spreadsheets/d/${SETB_SHEET_ID}/export?format=csv&gid=688068813`;

/** Hidden copy left by the old full rewrite. Repair no longer clears the tab, so this tab is not written again. */
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
  applyPosPrices(items);
  return { items: [...items.values()], combined };
}

/** Tri's store POS prices. These replace an ambiguous SETB cell. 666 and 667 stay off. */
const POS_UNIT_PRICES: Record<string, { name: string; cents: number; category: string }> = {
  "668": { name: "red ROSE Grabba Shaker", cents: 2000, category: "CIGARETTES" },
  "669": { name: "red HERRING Grabba Shaker", cents: 2000, category: "CIGARETTES" },
  "670": { name: "X2 red ROSE Grabba Shaker", cents: 3000, category: "CIGARETTES" },
  "671": { name: "X2 red HERRING Grabba Shaker", cents: 3000, category: "CIGARETTES" },
  "680": { name: "Sour 150mg Gummies IND", cents: 1600, category: "EDIBLES" },
  "681": { name: "Sour 150mg Gummies SAT", cents: 1600, category: "EDIBLES" },
  "682": { name: "Sour 600mg Gummies IND", cents: 3500, category: "EDIBLES" },
  "683": { name: "Sour 600mg Gummies SAT", cents: 3500, category: "EDIBLES" },
  "840": { name: "Sour Tangie (3G) Gold Hash", cents: 4000, category: "CONCENTRATES" },
  "841": { name: "Sour Diesel (3G) Gold Hash", cents: 4000, category: "CONCENTRATES" },
  "842": { name: "King Louis (3G) Gold Hash", cents: 4000, category: "CONCENTRATES" },
  "843": { name: "Chocolpe (3G) Gold Hash", cents: 4000, category: "CONCENTRATES" },
  "844": { name: "Cherry Fritter (3G) Gold Hash", cents: 3000, category: "CONCENTRATES" },
  "845": { name: "Lemon Lime Soda (3G) Gold Hash", cents: 4000, category: "CONCENTRATES" },
  "610": { name: "Berry Bombs Gummies (400mg)", cents: 2000, category: "EDIBLES" },
  "611": { name: "Stoned Berries Gummies (400mg)", cents: 2000, category: "EDIBLES" },
  "713": { name: "RAW Paper Cones 6PK", cents: 500, category: "ADD ONS" },
  "714": { name: "Backwoods Cigar", cents: 2500, category: "CIGARETTES" },
  "717": { name: "RAW Paper Cones 3PK King Size", cents: 500, category: "ADD ONS" },
  "720": { name: "Lighter Big", cents: 300, category: "ADD ONS" },
  "960": { name: "Frazzle Stilliezl 5000mg", cents: 4000, category: "EDIBLES" },
};

export function posUnitPrice(sku: string) {
  return POS_UNIT_PRICES[normalizeItemSku(sku)] ?? null;
}

function applyPosPrices(items: Map<string, ExpandedItem>) {
  for (const [sku, price] of Object.entries(POS_UNIT_PRICES)) {
    const current = items.get(sku);
    const dollars = (price.cents / 100).toFixed(2).replace(/\.00$/, "");
    if (current) {
      current.name = price.name;
      current.category = price.category;
      current.unitCents = price.cents;
      current.unit = "each";
      current.flag = "";
      current.priceEach = `$${dollars}`;
      continue;
    }
    items.set(sku, {
      sku,
      name: price.name,
      category: price.category,
      type: "",
      thc: "",
      mg: "",
      image: "",
      status: "ACTIVE",
      priceEach: `$${dollars}`,
      unitCents: price.cents,
      cartonDollars: null,
      unit: "each",
      sourceRows: [],
      flag: "",
    });
  }
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

function lineCell(headers: string[], line: string[], name: string) {
  const at = headers.findIndex((header) => headerKey(header) === headerKey(name));
  return at >= 0 ? String(line[at] ?? "") : "";
}

function priceUsable(headers: string[], line: string[]) {
  if (/^(ambiguous|missing|unparsed)/i.test(lineCell(headers, line, "Price_Flag"))) return false;
  return saleCents(lineCell(headers, line, "Unit_Price")) != null;
}

function nameUsable(headers: string[], line: string[], sku: string) {
  const name = lineCell(headers, line, "Name").replace(/\s+/g, " ").trim();
  return name.length > 0 && name !== sku;
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
  overlayPosPrices(index);
  return index;
}

/** Store prices Tri set by hand. A usable sheet row wins. A missing or flagged row uses these. */
function overlayPosPrices(index: ItemIndex) {
  for (const [sku, price] of Object.entries(POS_UNIT_PRICES)) {
    const current = index.get(sku);
    if (current && current.price_cents > 0 && current.name.trim() && current.name.trim() !== sku) continue;
    index.set(sku, {
      sku,
      name: price.name,
      category: price.category,
      price_cents: price.cents,
      image: current?.image ?? null,
    });
  }
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

export type ItemsPriceRepair = {
  header: string[];
  headerChanged: boolean;
  append: string[][];
  updates: { row: number; values: string[] }[];
};

/**
 * Rows to add or fill on Items_raw_price. An existing SKU with a usable price and name
 * is left as it is. Nothing is removed.
 */
export function planItemsPriceRepair(existing: string[][], items: ExpandedItem[]): ItemsPriceRepair {
  const base = existing.length > 0 ? existing : [["SKU", "Unit_Price", "Unit", "Source"]];
  const desired = mergeItemsPriceGrid(base, items);
  const headers = desired[0] ?? [];
  const oldHeaders = (existing[0] ?? []).map((cell) => String(cell ?? "").trim());
  while (oldHeaders.length > 0 && oldHeaders[oldHeaders.length - 1] === "") oldHeaders.pop();
  const headerChanged = headers.length !== oldHeaders.length
    || headers.some((header, index) => headerKey(header) !== headerKey(oldHeaders[index] ?? ""));
  const skuAt = Math.max(0, headers.findIndex((header) => headerKey(header) === "sku"));
  const oldSkuAt = Math.max(0, oldHeaders.findIndex((header) => headerKey(header) === "sku"));
  const have = new Map<string, { row: number; line: string[] }>();
  for (let index = 1; index < existing.length; index += 1) {
    const line = existing[index] ?? [];
    const sku = normalizeItemSku(String(line[oldSkuAt] ?? ""));
    if (!/^\d+$/.test(sku) || have.has(sku)) continue;
    have.set(sku, { row: index + 1, line });
  }
  const append: string[][] = [];
  const updates: { row: number; values: string[] }[] = [];
  for (const row of desired.slice(1)) {
    const sku = normalizeItemSku(String(row[skuAt] ?? ""));
    if (!/^\d+$/.test(sku)) continue;
    const prior = have.get(sku);
    if (!prior) {
      append.push(row);
      continue;
    }
    const fixPrice = !priceUsable(oldHeaders, prior.line) && saleCents(lineCell(headers, row, "Unit_Price")) != null;
    const desiredName = lineCell(headers, row, "Name").replace(/\s+/g, " ").trim();
    const fixName = !nameUsable(oldHeaders, prior.line, sku) && desiredName.length > 0 && desiredName !== sku;
    if (!fixPrice && !fixName) continue;
    const next = headers.map(() => "");
    oldHeaders.forEach((header, index) => {
      const at = headers.findIndex((name) => headerKey(name) === headerKey(header));
      if (at >= 0) next[at] = String(prior.line[index] ?? "");
    });
    if (fixPrice) {
      for (const name of ["Unit_Price", "Unit", "Source", "Price_Flag", "Price_EACH", "Carton_Price"]) {
        setCell(headers, next, name, lineCell(headers, row, name));
      }
    }
    if (fixName) {
      for (const name of ["Name", "Category", "ImageURL", "Type", "THC", "MG", "Status", "source_row"]) {
        const value = lineCell(headers, row, name);
        if (value) setCell(headers, next, name, value);
      }
    }
    updates.push({ row: prior.row, values: next });
  }
  return { header: headers, headerChanged, append, updates };
}

type PriceSheet = {
  readGrid(tab: string): Promise<string[][]>;
  repairPriceGrid(tab: string, plan: ItemsPriceRepair): Promise<void>;
};

/** Append or fill Items_raw_price from SETB. Does not delete rows and does not write SETB. */
export async function syncItemsRawPrice(sheet: PriceSheet) {
  if (process.env.PNY_SHEET_READ_ONLY === "1") {
    return { appended: [] as string[], repaired: [] as string[], skipped: "read-only" };
  }
  const existing = await sheet.readGrid("Items_raw_price");
  const setb = expandSetbItems(await fetchSetbItemGrid());
  const plan = planItemsPriceRepair(existing, setb.items);
  const skuAt = Math.max(0, plan.header.findIndex((header) => headerKey(header) === "sku"));
  if (plan.headerChanged || plan.append.length > 0 || plan.updates.length > 0) {
    await sheet.repairPriceGrid("Items_raw_price", plan);
  }
  return {
    appended: plan.append.map((row) => String(row[skuAt] ?? "")),
    repaired: plan.updates.map((update) => String(update.values[skuAt] ?? "")),
    skipped: "",
  };
}
