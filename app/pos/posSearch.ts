import { isFlowerCategory } from "../lib/pny-pos/flowerSku.ts";

type SellProduct = { sku: string; name: string; category: string };

function bySku(a: SellProduct, b: SellProduct) {
  return a.sku.localeCompare(b.sku, "en", { numeric: true });
}

/** A typed search covers every category. An empty search stays on the selected tab. */
export function filterSellProducts<T extends SellProduct>(rows: T[], query: string, activeCategory: string): T[] {
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((product) => {
    if (q) return product.sku.toLowerCase().includes(q) || product.name.toLowerCase().includes(q);
    return product.category === activeCategory;
  });
  if (!q && !isFlowerCategory(activeCategory)) return filtered;
  return [...filtered].sort(bySku);
}
