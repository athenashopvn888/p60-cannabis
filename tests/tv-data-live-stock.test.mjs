import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  DEFAULT_APPS_SCRIPT_URL,
  getTvData,
  postprocessFlowers,
  postprocessItems,
  resetTvStockCache,
} = require("../app/lib/tvStock.js");

const staticFlowers = JSON.parse(readFileSync(new URL("../app/lib/flowers.json", import.meta.url), "utf8"));
const staticItems = JSON.parse(readFileSync(new URL("../app/lib/items.json", import.meta.url), "utf8"));

beforeEach(() => {
  resetTvStockCache();
});

function flower(name, extra = {}) {
  return {
    sku: name,
    name,
    slug: name.toLowerCase(),
    tier: "AAA+",
    type: "hybrid",
    isHot: false,
    isSale: false,
    thc: "20%",
    price3g: { regular: 20, sale: null },
    price5g: null,
    price14g: null,
    price28g: null,
    image: "",
    ...extra,
  };
}

function item(name, price = "$10") {
  return {
    sku: name,
    name,
    slug: name.toLowerCase(),
    category: "VAPES",
    type: "",
    thc: "",
    mg: "",
    price,
    image: "",
    promoImage: null,
  };
}

function list(count, factory) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

function mockFetch(payload, { ok = true, status = 200, throwError = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (throwError) throw throwError;
    return {
      ok,
      status,
      async json() {
        if (payload instanceof Error) throw payload;
        return payload;
      },
    };
  };
  return { fetchImpl, calls };
}

test("live success post-processes stock and reports live headers", async () => {
  assert.ok(staticFlowers.length > 0);
  assert.ok(staticItems.length > 0);

  const flowers = list(57, (index) =>
    index === 0
      ? flower("GELATO AAA+ ON SALE")
      : flower(`FLOWER ${index}`, index === 1 ? { price3g: { regular: 20, sale: 15 } } : {}),
  );
  const items = list(56, (index) => (index === 0 ? item("CART", "$[object Object]") : item(`ITEM ${index}`)));
  const { fetchImpl, calls } = mockFetch({
    flowers,
    items,
    stockDate: "2026-09-26",
  });

  const flowerRes = await getTvData({
    type: "flowers",
    staticFlowers,
    staticItems,
    fetchImpl,
    appsScriptUrl: "",
    now: 1_000,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${DEFAULT_APPS_SCRIPT_URL}?store=PNY01`);
  assert.equal(calls[0].opts.cache, "no-store");
  assert.equal(calls[0].opts.signal.aborted, false);
  assert.equal(flowerRes.headers["x-tv-data-source"], "live");
  assert.equal(flowerRes.headers["x-tv-data-as-of"], "2026-09-26");
  assert.equal(flowerRes.headers["x-tv-data-store"], "PNY01");
  assert.equal(flowerRes.headers["x-tv-data-flower-count"], "57");
  assert.equal(flowerRes.headers["x-tv-data-item-count"], "56");
  assert.equal(flowerRes.headers["Cache-Control"], "no-store");
  assert.equal(flowerRes.body.length, 57);
  assert.equal(flowerRes.body[0].name, "GELATO");
  assert.equal(flowerRes.body[0].isSale, true);
  assert.equal(flowerRes.body[1].isSale, true);
  assert.notEqual(flowerRes.body, staticFlowers);

  const itemRes = await getTvData({
    type: "items",
    staticFlowers,
    staticItems,
    fetchImpl,
    appsScriptUrl: "https://ignored.example/exec",
    now: 1_000 + 299_000,
  });
  assert.equal(calls.length, 1);
  assert.equal(itemRes.body.length, 56);
  assert.equal(itemRes.body[0].price, "");
  assert.equal(itemRes.headers["x-tv-data-source"], "live");

  const other = await getTvData({
    type: "menu",
    staticFlowers,
    staticItems,
    fetchImpl,
    now: 2_000,
  });
  assert.equal(other.body, flowerRes.body);
});

test("fetch failure returns the static snapshot", async () => {
  const { fetchImpl } = mockFetch(null, { throwError: new Error("network down") });
  const result = await getTvData({
    type: "flowers",
    staticFlowers,
    staticItems,
    fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });

  assert.equal(result.headers["x-tv-data-source"], "static-fallback");
  assert.equal(result.headers["x-tv-data-as-of"], "");
  assert.equal(result.headers["x-tv-data-store"], "PNY01");
  assert.equal(result.headers["x-tv-data-flower-count"], String(staticFlowers.length));
  assert.equal(result.headers["x-tv-data-item-count"], String(staticItems.length));
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.match(result.headers["x-tv-data-fallback-reason"], /fetch failed: network down/);
  assert.equal(result.body, staticFlowers);
  assert.ok(result.body.length > 0);

  const items = await getTvData({
    type: "items",
    staticFlowers,
    staticItems,
    fetchImpl: mockFetch(null, { ok: false, status: 503 }).fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });
  assert.equal(items.body, staticItems);
  assert.equal(items.headers["x-tv-data-source"], "static-fallback");
  assert.ok(items.body.length > 0);
});

test("partial, empty, or invalid live stock falls back to the static snapshot", async () => {
  const partialFlowers = Math.floor(staticFlowers.length * 0.5) - 1;
  assert.ok(partialFlowers >= 0);
  assert.ok(partialFlowers < staticFlowers.length * 0.5);

  const partial = await getTvData({
    type: "flowers",
    staticFlowers,
    staticItems,
    fetchImpl: mockFetch({
      flowers: list(partialFlowers, (index) => flower(`P${index}`)),
      items: list(staticItems.length, (index) => item(`I${index}`)),
      stockDate: "2026-09-26",
    }).fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });
  assert.equal(partial.headers["x-tv-data-source"], "static-fallback");
  assert.equal(partial.body, staticFlowers);
  assert.equal(partial.headers["x-tv-data-flower-count"], String(staticFlowers.length));

  resetTvStockCache();
  const partialItems = await getTvData({
    type: "items",
    staticFlowers,
    staticItems,
    fetchImpl: mockFetch({
      flowers: list(staticFlowers.length, (index) => flower(`F${index}`)),
      items: list(Math.floor(staticItems.length * 0.5) - 1, (index) => item(`I${index}`)),
      stockDate: "2026-09-26",
    }).fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });
  assert.equal(partialItems.body, staticItems);
  assert.equal(partialItems.headers["x-tv-data-source"], "static-fallback");

  resetTvStockCache();
  const empty = await getTvData({
    type: "items",
    staticFlowers,
    staticItems,
    fetchImpl: mockFetch({ flowers: [], items: [], stockDate: "2026-09-26" }).fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });
  assert.equal(empty.body, staticItems);
  assert.ok(empty.body.length > 0);

  resetTvStockCache();
  const invalid = await getTvData({
    type: "flowers",
    staticFlowers,
    staticItems,
    fetchImpl: mockFetch(new SyntaxError("Unexpected token")).fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });
  assert.equal(invalid.body, staticFlowers);
  assert.equal(invalid.headers["x-tv-data-source"], "static-fallback");

  resetTvStockCache();
  const exactHalf = Math.ceil(staticFlowers.length * 0.5);
  const accepted = await getTvData({
    type: "flowers",
    staticFlowers,
    staticItems,
    fetchImpl: mockFetch({
      flowers: list(exactHalf, (index) => flower(`H${index}`)),
      items: list(staticItems.length, (index) => item(`I${index}`)),
      stockDate: "2026-09-26",
    }).fetchImpl,
    appsScriptUrl: "https://script.example/exec",
  });
  assert.equal(accepted.headers["x-tv-data-source"], "live");
  assert.equal(accepted.body.length, exactHalf);
});

test("HTTP 200 HTML, 429, and throws serve last-good with reason and cooldown", async () => {
  const goodFlowers = list(57, (index) => flower(`GOOD ${index}`));
  const goodItems = list(56, (index) => item(`GOOD ITEM ${index}`));

  for (const failure of [
    mockFetch(new SyntaxError("Unexpected token '<', HTML error")),
    mockFetch(null, { ok: false, status: 429 }),
    mockFetch(null, { throwError: new Error("network down") }),
  ]) {
    resetTvStockCache();
    const seed = await getTvData({
      type: "flowers", staticFlowers, staticItems,
      fetchImpl: mockFetch({ flowers: goodFlowers, items: goodItems, stockDate: "2026-10-08" }).fetchImpl,
      now: 1_000,
    });
    assert.equal(seed.headers["x-tv-data-source"], "live");

    let now = 302_000;
    const failed = await getTvData({ type: "flowers", staticFlowers, staticItems, fetchImpl: failure.fetchImpl, now });
    assert.equal(failed.headers["x-tv-data-source"], "last-good");
    assert.equal(failed.headers["x-tv-data-as-of"], "2026-10-08");
    assert.ok(failed.headers["x-tv-data-fallback-reason"]);
    assert.equal(failed.body.length, 57);
    assert.equal(failure.calls.length, 1);

    now += 30_000;
    const cooled = await getTvData({ type: "flowers", staticFlowers, staticItems, fetchImpl: failure.fetchImpl, now });
    assert.equal(cooled.headers["x-tv-data-source"], "last-good");
    assert.equal(failure.calls.length, 1);

    now += 31_000;
    await getTvData({ type: "flowers", staticFlowers, staticItems, fetchImpl: failure.fetchImpl, now });
    assert.equal(failure.calls.length, 2);
  }
});

test("prebuild uses the shared post-processor", () => {
  const prebuild = readFileSync(new URL("../scripts/prebuild-stock.js", import.meta.url), "utf8");
  assert.match(prebuild, /require\(['"]\.\.\/app\/lib\/tvStock\.js['"]\)/);
  assert.match(prebuild, /postprocessFlowers\(data\.flowers\)/);
  assert.match(prebuild, /postprocessItems\(data\.items\)/);
  assert.doesNotMatch(prebuild, /function cleanName/);
  assert.match(prebuild, /store=PNY01/);

  const flowers = [flower("COOKIE AAA+ SALE!"), flower("PLAIN", { isSale: true })];
  const { saleFixed } = postprocessFlowers(flowers);
  assert.equal(saleFixed, 1);
  assert.equal(flowers[0].name, "COOKIE");
  assert.equal(flowers[0].isSale, true);
  assert.equal(flowers[1].name, "PLAIN");

  const items = [item("BAD", "from $[object Object]"), item("OK", "$12")];
  const { itemsFixed } = postprocessItems(items);
  assert.equal(itemsFixed, 1);
  assert.equal(items[0].price, "");
  assert.equal(items[1].price, "$12");

  const galaxy = item("GALAXY GUMMIES 6000MG", "$20");
  galaxy.sku = "650";
  galaxy.image = "";
  postprocessItems([galaxy]);
  assert.equal(galaxy.image, "/products/640-641-GALAXY-6000.jpg");
});
