import { allFlowers, allItems, type FlowerProduct, type ItemProduct } from "./products";
import { getTvData } from "./tvStock";

export interface WebMenuData {
  flowers: FlowerProduct[];
  items: ItemProduct[];
  source: string;
  stockDate: string;
}

/**
 * Resolve the public web menu through the same store-scoped loader used by
 * /tv and /tv2. The shared loader owns live-feed validation, post-processing,
 * caching, and the safe static fallback.
 */
export async function getWebMenuData(): Promise<WebMenuData> {
  const [flowersResult, itemsResult] = await Promise.all([
    getTvData({ type: "flowers", staticFlowers: allFlowers, staticItems: allItems }),
    getTvData({ type: "items", staticFlowers: allFlowers, staticItems: allItems }),
  ]);

  return {
    flowers: flowersResult.body as FlowerProduct[],
    items: itemsResult.body as ItemProduct[],
    source: flowersResult.headers["x-tv-data-source"],
    stockDate: flowersResult.headers["x-tv-data-as-of"],
  };
}
