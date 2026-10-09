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
const TV_STOCK_FAILURE_CACHE_MS = 60 * 1000;
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
  const raw = explicit != null ? String(explicit) : String(process.env.MENU_FEED_URL || "");
  const trimmed = raw.trim();
  return trimmed || DEFAULT_APPS_SCRIPT_URL;
}

function stockEndpoint(baseUrl) {
  return `${baseUrl}?store=${TV_STORE}`;
}

// Menu freshness (Grok 2026-10-08). The feed URL is read ONLY from MENU_FEED_URL (default = shared feed);
// the legacy APPS_SCRIPT_URL env is ignored so it can never point TVs at an old Gmail-per-request script again.
// x-tv-data-stale = "1" when the stock being served is older than 48 h (or a bundled snapshot of unknown age),
// so /tv and /tv2 can show a small "Menu updating" notice instead of silently serving old stock.
const MENU_STALE_MS = 48 * 60 * 60 * 1000;
let STATIC_STOCK_META = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  STATIC_STOCK_META = require("./stock-meta.json");
} catch {
  STATIC_STOCK_META = {};
}

function menuStaleFlag(dataset, now = Date.now()) {
  const date =
    dataset.stockDate ||
    (dataset.source === "static-fallback" ? String(STATIC_STOCK_META.stockDate || "") : "");
  const t = Date.parse(date || "");
  if (!Number.isFinite(t)) return dataset.source === "live" ? "0" : "1";
  return now - t > MENU_STALE_MS ? "1" : "0";
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
let lastGood = null;
let failureUntil = 0;
let failureReason = "";
let inflight = null;

function resetTvStockCache() {
  cached = null;
  lastGood = null;
  failureUntil = 0;
  failureReason = "";
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
      ...(dataset.fallbackReason ? { "x-tv-data-fallback-reason": dataset.fallbackReason } : {}),
      "x-tv-data-stale": menuStaleFlag(dataset),
      "x-tv-data-snapshot-as-of": String(STATIC_STOCK_META.stockDate || ""),
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
      cache: "no-store",
    });

    if (!res || !res.ok) {
      const status = res ? res.status : "no response";
      return fallbackDataset(options, `HTTP ${status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      return fallbackDataset(options, `invalid JSON: ${err.message}`);
    }

    const reason = rejectLiveStock(data, options.staticFlowers, options.staticItems);
    if (reason) {
      return fallbackDataset(options, reason);
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
    lastGood = dataset;
    failureUntil = 0;
    failureReason = "";
    return dataset;
  } catch (err) {
    return fallbackDataset(options, `fetch failed: ${err.message}`);
  }
}

function fallbackDataset(options, reason) {
  const now = options.now ?? Date.now();
  failureReason = reason;
  failureUntil = now + TV_STOCK_FAILURE_CACHE_MS;
  const dataset = lastGood
    ? { ...lastGood, source: "last-good", fallbackReason: reason }
    : { ...staticDataset(options.staticFlowers, options.staticItems), fallbackReason: reason };
  console.warn(`[tv-data] Live stock failed (${reason}); serving ${dataset.source}`);
  return dataset;
}

async function getTvData(options) {
  const now = options.now ?? Date.now();
  let dataset;
  if (cached && now < cached.expiresAt) {
    dataset = cached.dataset;
  } else if (now < failureUntil) {
    dataset = lastGood
      ? { ...lastGood, source: "last-good", fallbackReason: failureReason }
      : { ...staticDataset(options.staticFlowers, options.staticItems), fallbackReason: failureReason };
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
  TV_STOCK_FAILURE_CACHE_MS,
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
