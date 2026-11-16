import { parseFlowerSku, skuSortKey } from "./flowerSku.ts";
import { flowerPriceCents, overlayFlower, type FlowerIndex } from "./flowerRaw.ts";
import { lookupItem, type ItemIndex } from "./itemRaw.ts";
import { paperLines } from "./paperRefill.ts";
import { cigarettePackCents, quoteForSku } from "./sizePrice.ts";
import { defaultThcCatalogFlag } from "./thcSkuFlags.ts";
import type { ProductRow, State, StoreProductRow } from "./types.ts";

export type TillMenuItem = {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  image_url?: string | null;
};

export type TillCatalogSource =
  | "PNY01_MENU"
  | "FLOWERS_RAW"
  | "ITEMS_RAW_PRICE"
  | "TILL_QUOTE"
  | "PAPER_COUNT_UNPRICED"
  | "CATALOG_FEED";

type CatalogState = Pick<State, "products" | "store_products" | "balances">;

type Resolved = {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  image_url: string | null;
  active: boolean;
  source: TillCatalogSource;
};

function resolvedForSku(
  sku: string,
  existing: ProductRow | undefined,
  flowers: FlowerIndex,
  items: ItemIndex,
  menu: Map<string, TillMenuItem>,
): Resolved {
  const live = menu.get(sku);
  if (live && live.price_cents >= 0) {
    return {
      sku,
      name: live.name || existing?.name || sku,
      category: live.category || existing?.category || "Uncategorized",
      price_cents: live.price_cents,
      image_url: live.image_url ?? existing?.image_url ?? null,
      active: live.price_cents > 0,
      source: "PNY01_MENU",
    };
  }

  if (parseFlowerSku(sku) && flowerPriceCents(flowers, sku) != null) {
    const shown = overlayFlower({
      sku,
      name: existing?.name || sku,
      category: existing?.category || "Flower",
      price_cents: existing?.default_price_cents ?? 0,
      image_url: existing?.image_url ?? null,
    }, flowers);
    return {
      sku,
      name: shown.name,
      category: shown.category,
      price_cents: flowerPriceCents(flowers, sku) ?? shown.price_cents,
      image_url: shown.image_url ?? null,
      active: true,
      source: "FLOWERS_RAW",
    };
  }

  const item = lookupItem(items, sku);
  if (item) {
    const pack = cigarettePackCents(sku, item.category, item.name);
    return {
      sku,
      name: item.name || existing?.name || sku,
      category: item.category || existing?.category || "Uncategorized",
      price_cents: pack ?? item.price_cents,
      image_url: item.image ?? existing?.image_url ?? null,
      active: (pack ?? item.price_cents) > 0,
      source: "ITEMS_RAW_PRICE",
    };
  }

  const quote = quoteForSku(sku);
  if (quote) {
    return {
      sku,
      name: quote.name || existing?.name || sku,
      category: quote.category || existing?.category || "Uncategorized",
      price_cents: quote.cents,
      image_url: quote.image ?? existing?.image_url ?? null,
      active: quote.cents > 0,
      source: "TILL_QUOTE",
    };
  }

  const paper = paperLines().find((row) => row.sku === sku);
  if (paper) {
    return {
      sku,
      name: paper.name || existing?.name || sku,
      category: /backwoods|cigar|cigarette/i.test(paper.name) ? "CIGARETTES" : existing?.category || "UNAVAILABLE",
      // PNY01's till has no selling-price source for this paper-count row.
      price_cents: 0,
      image_url: existing?.image_url ?? null,
      active: false,
      source: "PAPER_COUNT_UNPRICED",
    };
  }

  return {
    sku,
    name: existing?.name || sku,
    category: existing?.category || "UNAVAILABLE",
    price_cents: existing?.default_price_cents ?? 0,
    image_url: existing?.image_url ?? null,
    active: existing?.setb_active ?? false,
    source: "CATALOG_FEED",
  };
}

/**
 * Reconcile persisted catalog rows with the same name/price layers used by the
 * PNY01 till. Stock quantities are never changed. Every balance SKU receives a
 * product and store_product row, including an explicit disabled/unpriced row
 * when the till itself has no sellable price.
 */
export function reconcileTillCatalog(
  state: CatalogState,
  storeCode: string,
  at: string,
  inputs: { flowers: FlowerIndex; items: ItemIndex; menu?: TillMenuItem[] },
) {
  const beforeBalances = JSON.stringify(state.balances);
  const existingProducts = new Map(state.products.map((row) => [row.sku, row]));
  const existingStores = new Map(
    state.store_products.filter((row) => row.store_code === storeCode).map((row) => [row.sku, row]),
  );
  const menu = new Map((inputs.menu ?? []).map((row) => [row.sku, row]));
  const skus = new Set(state.products.map((row) => row.sku));
  for (const balance of state.balances) {
    if ((balance.store_code ?? storeCode) === storeCode) skus.add(balance.sku);
  }

  const sources: Record<TillCatalogSource, number> = {
    PNY01_MENU: 0,
    FLOWERS_RAW: 0,
    ITEMS_RAW_PRICE: 0,
    TILL_QUOTE: 0,
    PAPER_COUNT_UNPRICED: 0,
    CATALOG_FEED: 0,
  };
  const sourceBySku: Record<string, TillCatalogSource> = {};
  const products: ProductRow[] = [];
  const storeProducts: StoreProductRow[] = [];
  for (const sku of skus) {
    const existing = existingProducts.get(sku);
    const resolved = resolvedForSku(sku, existing, inputs.flowers, inputs.items, menu);
    sources[resolved.source] += 1;
    sourceBySku[sku] = resolved.source;
    const product: ProductRow = {
      sku,
      sku_sort: skuSortKey(sku),
      name: resolved.name,
      category: resolved.category,
      default_price_cents: resolved.price_cents,
      image_url: resolved.image_url,
      setb_active: resolved.active,
      thc_flag: defaultThcCatalogFlag({ sku, name: resolved.name, category: resolved.category }),
      synced_at: at,
      created_at: existing?.created_at ?? at,
    };
    products.push(product);
    const prior = existingStores.get(sku);
    storeProducts.push({
      store_code: storeCode,
      sku,
      enabled: prior?.enabled === false ? false : product.setb_active,
      price_override_cents: prior?.price_override_cents ?? null,
      created_at: prior?.created_at ?? at,
      updated_at: at,
    });
  }
  products.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
  storeProducts.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
  state.products = products;
  state.store_products = [
    ...state.store_products.filter((row) => row.store_code !== storeCode),
    ...storeProducts,
  ];
  if (JSON.stringify(state.balances) !== beforeBalances) throw new Error("Catalog reconciliation changed balances");

  const missingBalanceSkus = state.balances
    .filter((row) => (row.store_code ?? storeCode) === storeCode && !products.some((product) => product.sku === row.sku))
    .map((row) => row.sku);
  return { products: products.length, store_products: storeProducts.length, sources, sourceBySku, missingBalanceSkus };
}
