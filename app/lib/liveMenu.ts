import { allFlowers, allItems, type FlowerProduct, type ItemProduct } from "./products";
import { getTvData } from "./tvStock";

/**
 * ONE product loader for every web page (Grok 2026-10-08/09): the same getTvData() call /api/tv-data uses
 * (same feed, validation, 5-min cache, live -> last-good -> static only as last resort),
 * so the web menu, /tv and /tv2 always show the same products.
 */
export async function getLiveMenu(): Promise<{ flowers: FlowerProduct[]; items: ItemProduct[] }> {
  const [f, i] = await Promise.all([
    getTvData({ type: "flowers", staticFlowers: allFlowers, staticItems: allItems }),
    getTvData({ type: "items", staticFlowers: allFlowers, staticItems: allItems }),
  ]);
  return {
    flowers: Array.isArray(f?.body) ? (f.body as unknown as FlowerProduct[]) : allFlowers,
    items: Array.isArray(i?.body) ? (i.body as unknown as ItemProduct[]) : allItems,
  };
}

export async function liveFlowersByTier(tier: string): Promise<FlowerProduct[]> {
  const { flowers } = await getLiveMenu();
  return flowers.filter((f) => String(f.tier || "").toUpperCase() === String(tier || "").toUpperCase());
}

export async function liveItemsByCategory(category: string): Promise<ItemProduct[]> {
  const { items } = await getLiveMenu();
  return items.filter((i) => String(i.category || "").toUpperCase() === String(category || "").toUpperCase());
}
