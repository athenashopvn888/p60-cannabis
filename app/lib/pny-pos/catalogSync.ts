import { skuSortKey } from "./flowerSku.ts";
import { catalogFromFeed, readCommittedPnyCatalog } from "./setbFeed.ts";
import { defaultThcCatalogFlag } from "./thcSkuFlags.ts";
import type { State } from "./types.ts";

function balanceForStore(row: { store_code?: string }, storeCode: string) {
  return storeCode === "PNY01" ? !row.store_code || row.store_code === storeCode : row.store_code === storeCode;
}

const FLOWER_CATEGORIES = new Set(["BUDGET", "AA", "AAA+", "PREMIUM", "EXOTIC"]);

function isFlowerSource(row: { sku: string; category: string }) {
  return row.sku.includes("-") && FLOWER_CATEGORIES.has(row.category.trim().toUpperCase());
}

/**
 * Merge the complete tracked PNY catalog without creating stock.
 * New zero-stock SKUs remain disabled on the sell screen, but are available to
 * refill and closing-count search. A positive existing balance enables them.
 */
export function syncCommittedCatalog(state: State, storeCode: string, at = new Date().toISOString()) {
  let changed = 0;
  for (const source of catalogFromFeed(readCommittedPnyCatalog())) {
    let product = state.products.find((row) => row.sku === source.sku);
    if (!product) {
      product = {
        sku: source.sku,
        thc_flag: defaultThcCatalogFlag(source),
        sku_sort: skuSortKey(source.sku),
        name: source.name,
        category: source.category,
        default_price_cents: source.price_cents,
        image_url: source.image_url,
        setb_active: source.active,
        synced_at: at,
        created_at: at,
      };
      state.products.push(product);
      changed += 1;
    } else {
      // Existing ITEM rows may contain audited split-SKU labels and prices, so
      // the committed master only fills their gaps. Flower prices are the one
      // exception: FLOWERS_RAW is authoritative, including the final value in
      // a regular|sale price such as 30|25.
      if (!product.name && source.name) product.name = source.name;
      if (!product.category && source.category) product.category = source.category;
      if (isFlowerSource(source) && source.price_cents > 0 && product.default_price_cents !== source.price_cents) {
        product.default_price_cents = source.price_cents;
        product.synced_at = at;
        changed += 1;
      } else if ((!product.default_price_cents || product.default_price_cents <= 0) && source.price_cents > 0) {
        product.default_price_cents = source.price_cents;
      }
      if (!product.image_url && source.image_url) product.image_url = source.image_url;
      if (product.thc_flag == null) product.thc_flag = defaultThcCatalogFlag(source);
    }

    let storeProduct = state.store_products.find((row) => row.store_code === storeCode && row.sku === source.sku);
    if (!storeProduct) {
      const onHand = state.balances.find((row) => row.sku === source.sku && balanceForStore(row, storeCode))?.qty ?? 0;
      storeProduct = {
        store_code: storeCode,
        sku: source.sku,
        enabled: source.active && onHand > 0,
        price_override_cents: null,
        created_at: at,
        updated_at: at,
      };
      state.store_products.push(storeProduct);
      changed += 1;
    }
  }
  return changed;
}

export function committedCatalogSearch(state: State) {
  return state.products
    .filter((product) => product.setb_active)
    .sort((a, b) => a.sku_sort - b.sku_sort || a.sku.localeCompare(b.sku, "en", { numeric: true }))
    .map((product) => ({ sku: product.sku, name: product.name }));
}
