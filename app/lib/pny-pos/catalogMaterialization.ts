import { skuSortKey } from "./flowerSku.ts";
import type { SetbProduct } from "./setbFeed.ts";
import { defaultThcCatalogFlag } from "./thcSkuFlags.ts";
import type { ProductRow, State, StoreProductRow } from "./types.ts";

type CatalogState = Pick<State, "products" | "store_products" | "balances">;

/**
 * Persist the read-only PNY catalog feed beside the cloned balances.
 * The feed never supplies stock; balances are deliberately left untouched.
 */
export function materializeCatalog(
  state: CatalogState,
  feed: SetbProduct[],
  storeCode: string,
  at: string,
) {
  const existingProducts = new Map(state.products.map((row) => [row.sku, row]));
  const existingStoreProducts = new Map(
    state.store_products.filter((row) => row.store_code === storeCode).map((row) => [row.sku, row]),
  );
  const feedSkus = new Set(feed.map((row) => row.sku));

  const products: ProductRow[] = feed.map((row) => {
    const existing = existingProducts.get(row.sku);
    return {
      sku: row.sku,
      sku_sort: skuSortKey(row.sku),
      name: row.name,
      category: row.category,
      default_price_cents: row.price_cents,
      image_url: row.image_url,
      setb_active: row.active,
      thc_flag: defaultThcCatalogFlag(row),
      synced_at: at,
      created_at: existing?.created_at ?? at,
    };
  });

  // PNY01 may contain newly-added till products that have not reached the
  // customer-menu feed yet. Keep those rows and classify them explicitly.
  for (const existing of state.products) {
    if (feedSkus.has(existing.sku)) continue;
    products.push({
      ...existing,
      thc_flag: defaultThcCatalogFlag(existing),
    });
  }
  products.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));

  const storeProducts: StoreProductRow[] = products.map((product) => {
    const existing = existingStoreProducts.get(product.sku);
    return {
      store_code: storeCode,
      sku: product.sku,
      enabled: existing?.enabled ?? product.setb_active,
      price_override_cents: existing?.price_override_cents ?? null,
      created_at: existing?.created_at ?? at,
      updated_at: existing?.updated_at ?? at,
    };
  });

  state.products = products;
  state.store_products = [
    ...state.store_products.filter((row) => row.store_code !== storeCode),
    ...storeProducts,
  ];

  return {
    products: products.length,
    store_products: storeProducts.length,
    balances: state.balances.filter((row) => (row.store_code ?? storeCode) === storeCode).length,
  };
}

