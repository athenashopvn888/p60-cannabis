/**
 * Shared PNY01 stock post-processing and TV menu loading.
 *
 * prebuild-stock.js (CommonJS) and app/api/tv-data/route.ts both use this
 * module so sale flags, flower names, mangled item prices, and the Galaxy
 * Gummies image fallback stay in sync.
 *
 * The route caches a successful live payload for TV_STOCK_CACHE_MS (in memory,
 * and via fetch `next.revalidate` when the Next.js data cache honors it).
 * Failures are not cached. Callers still send Cache-Control: no-store.
 */

const DEFAULT_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx09_sDal1eMVF1r-hUck4e7oq_XBHEWhGvA79JuhZNQ6P4CdhCas0xE3FfexWQ3hq4/exec";

const TV_STORE = "PNY01";
const TV_STOCK_CACHE_MS = 300 * 1000;
const TV_STOCK_FETCH_TIMEOUT_MS = 25000;
const PARTIAL_STOCK_RATIO = 0.5;

const SALE_RE = /\bSALE\b/i;
const ON_SALE_RE = /ON\s*SALE/i;

function hasSalePrice(flower) {
  return !!(
    (flower.price3g && flower.price3g.sale !== null) ||
    (flower.price5g && flower.price5g.sale !== null) ||
    (flower.price14g && flower.price14g.sale !== null) ||
    (flower.price28g && flower.price28g.sale !== null)
  );
}

function cleanName(name) {
  return name
    .replace(/\s*\(?\s*AAA\+?\s*ON\s*SALE\s*\)?\s*$/i, "")
    .replace(/\s*\(?\s*AAA\+?\s*SALE!?\s*\)?\s*$/i, "")
    .replace(/\s*\bSALE!?\s*$/i, "")
    .replace(/\s*\bON\s*SALE\s*$/i, "")
    .trim();
}

function postprocessFlowers(flowers) {
  let saleFixed = 0;
  for (const flower of flowers) {
    if (!flower.isSale) {
      if (SALE_RE.test(flower.name) || ON_SALE_RE.test(flower.name) || hasSalePrice(flower)) {
        flower.isSale = true;
        saleFixed++;
      }
    }
    flower.name = cleanName(flower.name);
  }
  return { flowers, saleFixed };
}

function postprocessItems(items) {
  let itemsFixed = 0;
  for (const item of items) {
    if (typeof item.price === "string" && item.price.includes("[object")) {
      item.price = "";
      itemsFixed++;
    }
    if (String(item.sku || "").includes("650") && /GALAXY GUMMIES 6000MG/i.test(item.name || "") && !item.image) {
      item.image = "/products/640-641-GALAXY-6000.jpg";
    }
  }
  return { items, itemsFixed };
}

function resolveAppsScriptUrl(explicit) {
  const raw = explicit != null ? String(explicit) : String(process.env.APPS_SCRIPT_URL || "");
  const trimmed = raw.trim();
  return trimmed || DEFAULT_APPS_SCRIPT_URL;
}

function stockEndpoint(baseUrl) {
  return `${baseUrl}?store=${TV_STORE}`;
}

function staticDataset(staticFlowers, staticItems) {
  return {
    source: "static-fallback",
    flowers: Array.isArray(staticFlowers) ? staticFlowers : [],
    items: Array.isArray(staticItems) ? staticItems : [],
    stockDate: "",
  };
}

function rejectLiveStock(data, staticFlowers, staticItems) {
  if (!data || typeof data !== "object") return "invalid payload";
  if (!Array.isArray(data.flowers) || !Array.isArray(data.items)) return "missing flowers or items";
  if (data.flowers.length === 0 || data.items.length === 0) return "empty flowers or items";

  const flowerBaseline = Array.isArray(staticFlowers) ? staticFlowers.length : 0;
  const itemBaseline = Array.isArray(staticItems) ? staticItems.length : 0;
  if (flowerBaseline > 0 && data.flowers.length < flowerBaseline * PARTIAL_STOCK_RATIO) {
    return `partial flowers ${data.flowers.length}/${flowerBaseline}`;
  }
  if (itemBaseline > 0 && data.items.length < itemBaseline * PARTIAL_STOCK_RATIO) {
    return `partial items ${data.items.length}/${itemBaseline}`;
  }
  return null;
}

let cached = null;
let inflight = null;

function resetTvStockCache() {
  cached = null;
  inflight = null;
}

function selectTvPayload(dataset, type) {
  const body = type === "items" ? dataset.items : dataset.flowers;
  return {
    body,
    headers: {
      "x-tv-data-source": dataset.source,
      "x-tv-data-as-of": dataset.stockDate,
      "x-tv-data-store": TV_STORE,
      "x-tv-data-flower-count": String(dataset.flowers.length),
      "x-tv-data-item-count": String(dataset.items.length),
      "Cache-Control": "no-store",
    },
  };
}

async function resolveDataset(options) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? TV_STOCK_FETCH_TIMEOUT_MS;
  const endpoint = stockEndpoint(resolveAppsScriptUrl(options.appsScriptUrl));

  try {
    const res = await fetchImpl(endpoint, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 300 },
    });

    if (!res || !res.ok) {
      const status = res ? res.status : "no response";
      console.warn(`[tv-data] Live stock HTTP ${status}; serving static snapshot`);
      return staticDataset(options.staticFlowers, options.staticItems);
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      console.warn(`[tv-data] Live stock JSON invalid (${err.message}); serving static snapshot`);
      return staticDataset(options.staticFlowers, options.staticItems);
    }

    const reason = rejectLiveStock(data, options.staticFlowers, options.staticItems);
    if (reason) {
      console.warn(`[tv-data] Live stock rejected (${reason}); serving static snapshot`);
      return staticDataset(options.staticFlowers, options.staticItems);
    }

    postprocessFlowers(data.flowers);
    postprocessItems(data.items);

    const dataset = {
      source: "live",
      flowers: data.flowers,
      items: data.items,
      stockDate: data.stockDate == null ? "" : String(data.stockDate),
    };
    const now = options.now ?? Date.now();
    cached = { expiresAt: now + TV_STOCK_CACHE_MS, dataset };
    return dataset;
  } catch (err) {
    console.warn(`[tv-data] Live stock fetch failed (${err.message}); serving static snapshot`);
    return staticDataset(options.staticFlowers, options.staticItems);
  }
}

async function getTvData(options) {
  const now = options.now ?? Date.now();
  let dataset;
  if (cached && now < cached.expiresAt) {
    dataset = cached.dataset;
  } else {
    if (!inflight) {
      inflight = resolveDataset(options).finally(() => {
        inflight = null;
      });
    }
    dataset = await inflight;
  }

  const requested = options.type === "items" ? dataset.items : dataset.flowers;
  const staticRequested = options.type === "items" ? options.staticItems : options.staticFlowers;
  if (
    Array.isArray(requested) &&
    requested.length === 0 &&
    Array.isArray(staticRequested) &&
    staticRequested.length > 0
  ) {
    dataset = staticDataset(options.staticFlowers, options.staticItems);
  }

  return selectTvPayload(dataset, options.type);
}

module.exports = {
  DEFAULT_APPS_SCRIPT_URL,
  TV_STORE,
  TV_STOCK_CACHE_MS,
  TV_STOCK_FETCH_TIMEOUT_MS,
  PARTIAL_STOCK_RATIO,
  hasSalePrice,
  cleanName,
  postprocessFlowers,
  postprocessItems,
  resolveAppsScriptUrl,
  getTvData,
  resetTvStockCache,
};
