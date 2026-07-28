import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateMenu } from "./farmerslink-menu.mjs";

const menu = JSON.parse(await readFile(new URL("../app/delivery/delivery-menu.json", import.meta.url), "utf8"));
const component = await readFile(new URL("../app/delivery/DeliveryCatalog.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/delivery/delivery.css", import.meta.url), "utf8");
const banner = await readFile(new URL("../public/p60-delivery-menu-banner.webp", import.meta.url));
const products = menu.products;

assert.deepEqual([menu.store.id, menu.store.code, menu.store.pod], ["P60", "PNY01", "POD01"]);
assert.equal(menu.source, "Farmers Link public live catalog");
assert.equal(products.length, 63);
assert(component.includes("milestone-1-demo.vercel.app/api/catalog?store=P60"));
assert(component.includes('src="/p60-delivery-menu-banner.webp"'));
assert(component.includes("width={1774}") && component.includes("height={887}"));
assert(component.includes("Member Loyalty Savings"));
assert(component.includes("Rewards and coupons apply to a later order"));
assert(component.includes("<strong>Member Loyalty</strong>"));
assert(!component.includes("<strong>{offer.title}</strong>"));
assert(css.includes(".member-offer") && css.includes("#0b3a63"));
assert(css.includes("object-fit:contain"));
assert(css.includes("@media(max-width:560px)"));
assert(banner.length < 2277385);
validateMenu(menu);

const tierCounts = Object.fromEntries(["Exotics", "CRAFTS", "BC Premium", "Budget", "SHREDS"].map((name) => [
  name,
  products.filter((product) => product.tier === name).length,
]));
assert.deepEqual(tierCounts, { Exotics: 14, CRAFTS: 13, "BC Premium": 15, Budget: 18, SHREDS: 3 });

const craft408 = products.find((product) => product.sku === "408");
assert.deepEqual(craft408.priceOptions.map((option) => option.label), ["14g", "28g"]);
assert.equal(craft408.offers.find((offer) => offer.kind === "prime_time").label, "$140/28g + 3g CRAFT COUPON");
assert.equal(craft408.offers.find((offer) => offer.kind === "multi_ounce").label, "2 × 28g at $140 each — $280 total");

const budget184 = products.find((product) => product.sku === "184");
assert.deepEqual(budget184.priceOptions, [{ key: "weight_28g", label: "28g", price: 75 }]);
assert.deepEqual(budget184.offers.map((offer) => offer.label), ["2 × 28g — $90 total", "4 × 28g — $160 total"]);

const shred106 = products.find((product) => product.sku === "106");
assert.equal(shred106.offers[0].label, "3 × 28g — $95 total");

for (const product of products) {
  for (const offer of product.offers.filter((item) => item.kind === "multi_ounce")) {
    assert.match(offer.label, /^\d+ × 28g(?: at \$\d+ each)? — \$\d+ total$/);
  }
}

console.log(`Verified ${products.length} P60 products, store banner, loyalty UI, and offer semantics`, tierCounts);
