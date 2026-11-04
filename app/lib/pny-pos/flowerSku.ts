export const FLOWER_SIZES = ["3g", "5g", "14g", "28g"] as const;

const FLOWER_CATEGORIES = new Set(["flower", "flowers", "budget", "aa", "aaa", "aaa+", "premium", "exotic"]);

export function isFlowerCategory(category: string) {
  return FLOWER_CATEGORIES.has(category.trim().toLowerCase());
}

export function parseFlowerSku(sku: string): { base: string; size: string } | null {
  const match = /^(.*)-(3g|5g|14g|28g)$/i.exec(sku.trim());
  if (!match?.[1] || !match[2]) return null;
  return { base: match[1], size: match[2].toLowerCase() };
}

export function strainName(name: string) {
  return name.replace(/\s+(3g|5g|14g|28g)$/i, "").trim();
}

/** Customer and till label. 300/400/500-series 5g bags are sold as 6g. The SKU stays `-5g`. */
export function bagLabel(sku: string) {
  const parsed = parseFlowerSku(sku);
  if (!parsed) return "";
  const series = Number(parsed.base);
  if (parsed.size === "5g" && series >= 300 && series < 600) return "6g";
  return parsed.size;
}

export function skuSortKey(sku: string) {
  const base = parseFlowerSku(sku)?.base ?? sku;
  const value = Number(base);
  return Number.isFinite(value) ? value : 0;
}

export type StrainBlock<T> = { kind: "strain"; base: string; name: string; category: string; sizes: T[] };
export type ItemBlock<T> = { kind: "item"; item: T };

/** Group sized flower SKUs under the strain. Other products stay one row each. */
export function groupByStrain<T extends { sku: string; name: string; category: string }>(rows: T[]): Array<StrainBlock<T> | ItemBlock<T>> {
  const order: Array<StrainBlock<T> | ItemBlock<T>> = [];
  const at = new Map<string, StrainBlock<T>>();
  for (const row of rows) {
    const parsed = parseFlowerSku(row.sku);
    if (!parsed || !isFlowerCategory(row.category)) {
      order.push({ kind: "item", item: row });
      continue;
    }
    const key = `${row.category}\0${parsed.base}`;
    let block = at.get(key);
    if (!block) {
      block = { kind: "strain", base: parsed.base, name: strainName(row.name), category: row.category, sizes: [] };
      at.set(key, block);
      order.push(block);
    }
    block.sizes.push(row);
  }
  for (const block of order) {
    if (block.kind !== "strain") continue;
    block.sizes.sort((a, b) => {
      const left = FLOWER_SIZES.indexOf((parseFlowerSku(a.sku)?.size ?? "") as (typeof FLOWER_SIZES)[number]);
      const right = FLOWER_SIZES.indexOf((parseFlowerSku(b.sku)?.size ?? "") as (typeof FLOWER_SIZES)[number]);
      return left - right;
    });
  }
  return order;
}
