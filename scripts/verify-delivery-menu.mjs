import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const path = new URL("../app/delivery/delivery-menu.json", import.meta.url);
const menu = JSON.parse(await readFile(path, "utf8"));
const products = menu.products;

assert.equal(menu.store.id, "P60");
assert.equal(menu.store.code, "PNY01");
assert.equal(menu.store.pod, "POD01");
assert.equal(products.length, 51, "PNY01 action-time visible count must be 51");

const expectedSkus = "207,209,261,269,271,275,278,288,290,291,292,293,339,340,341,343,344,345,346,347,348,393,415,416,473,475,480,481,482,483,484,490,492,493,494,504,507,513,514,538,539,540,543,550,560,561,562,593,594,595,596".split(",");
assert.deepEqual(products.map((product) => product.sku), expectedSkus);
assert.equal(new Set(expectedSkus).size, products.length);
assert(!expectedSkus.includes("422"));

const tierCounts = { Exotics: 0, CRAFTS: 0, "BC Premium": 0, Budget: 0, SHREDS: 0 };
function tier(product) {
  const sku = Number(product.sku);
  if (sku >= 100 && sku <= 199 && /\bSHREDS?\b/i.test(product.name)) return "SHREDS";
  if (sku >= 100 && sku <= 299) return "Budget";
  if (sku >= 300 && sku <= 399) return "BC Premium";
  if (sku >= 400 && sku <= 499) return "CRAFTS";
  if (sku >= 500 && sku <= 599) return "Exotics";
  throw new Error(`Out-of-tier SKU ${product.sku}`);
}

for (const product of products) {
  tierCounts[tier(product)] += 1;
  assert(product.name);
  assert(product.image.startsWith("https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/"));
  assert(product.priceOptions.length > 0, `Missing visible price for ${product.sku}`);
  for (const option of product.priceOptions) {
    assert(["3g", "5g", "14g", "28g"].includes(option.label));
    assert(Number.isFinite(option.price) && option.price > 0);
    if (option.regularPrice !== undefined) assert(option.regularPrice > option.price);
  }
}

assert.deepEqual(tierCounts, { Exotics: 16, CRAFTS: 13, "BC Premium": 10, Budget: 12, SHREDS: 0 });
assert.deepEqual(products.find((p) => p.sku === "561").priceOptions.map((o) => o.label), ["3g"]);
assert.deepEqual(products.find((p) => p.sku === "595").priceOptions.map((o) => o.label), ["3g", "5g", "14g"]);
assert.deepEqual(products.find((p) => p.sku === "596").priceOptions.map((o) => o.label), ["3g", "5g"]);

console.log(`Verified ${products.length} PNY01 delivery products`, tierCounts);
