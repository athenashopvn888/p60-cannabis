import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateMenu } from "./farmerslink-menu.mjs";

const menu = JSON.parse(await readFile(new URL("../app/delivery/delivery-menu.json", import.meta.url), "utf8"));
const component = await readFile(new URL("../app/delivery/DeliveryCatalog.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/delivery/delivery.css", import.meta.url), "utf8");
const banner = await readFile(new URL("../public/p60-delivery-menu-banner.webp", import.meta.url));
const products = menu.products;

assert.deepEqual([menu.store.id, menu.store.code, menu.store.pod], ["P60", "PNY01", "POD01"]);
assert.equal(products.length, 63);
assert(component.includes("api/catalog?store=P60"));
assert(!component.includes("Other weights") && !component.includes("SKU {product.sku}") && !component.includes("Product, SKU"));
assert(component.includes("${product.name} ${product.sku} ${product.category}") && component.includes("parseTierSku(product.sku)"));
assert(component.includes("compact-price-grid") && component.includes("compact.map"));
assert(component.includes("Member Loyalty Savings"));
assert(component.includes("STANDARD 28g") && component.includes("MEMBER LOYALTY 28g") && component.includes("× 28g DEAL"));
assert(component.includes("<small>each</small>") && component.includes("<small>total</small>"));
assert(!component.includes("PRIME TIME") && !component.includes("2oz promo"));
assert(css.includes(".member-28") && css.includes("#0b3a63"));
assert(css.includes(".bundle-decision") && css.includes(".pny-tile-grid { grid-template-columns:repeat(2,minmax(0,1fr));"));
assert(component.includes("totalPrice: loyaltyPrice * 2") && component.includes("offer.quantity !== 2"));
assert(component.indexOf("MEMBER LOYALTY 28g") < component.indexOf("STANDARD 28g"));
assert(css.includes("background:linear-gradient(145deg,#3b0764,#6b21a8)") && !css.includes("background:linear-gradient(145deg,#2a1c08,#49300b)"));
assert(css.includes("min-height:44px") && css.includes("@media(max-width:560px)"));
assert(component.includes('src="/p60-delivery-menu-banner.webp"') && component.includes("width={1774}") && component.includes("height={887}"));
assert(css.includes("object-fit:contain"));
assert(banner.length === 331936);
validateMenu(menu);

const tierCounts = Object.fromEntries(["Exotics", "CRAFTS", "BC Premium", "Budget", "SHREDS"].map((name) => [name, products.filter((product) => product.tier === name).length]));
assert.deepEqual(tierCounts, { Exotics: 14, CRAFTS: 13, "BC Premium": 15, Budget: 18, SHREDS: 3 });

const craft408 = products.find((product) => product.sku === "408");
assert.equal(craft408.offers.find((offer) => offer.kind === "prime_time").price, 140);
assert.equal(craft408.offers.find((offer) => offer.kind === "multi_ounce" && offer.quantity === 2).totalPrice, 280);
const exotic563 = products.find((product) => product.sku === "563");
assert.equal(exotic563.offers.find((offer) => offer.kind === "multi_ounce" && offer.quantity === 2).totalPrice, exotic563.offers.find((offer) => offer.kind === "prime_time").price * 2);
const premium376 = products.find((product) => product.sku === "376");
assert.equal(premium376.offers.find((offer) => offer.kind === "prime_time").price, premium376.priceOptions.find((option) => option.label === "28g").price - 30);
for (const product of products.filter((item) => ["Budget", "SHREDS"].includes(item.tier))) assert(!product.offers.some((offer) => offer.kind === "prime_time"));
assert(!JSON.stringify(products).includes('"provenance"'));

for (const product of products) for (const offer of product.offers.filter((item) => item.kind === "multi_ounce")) {
  assert.match(offer.label, /^\d+ × 28g(?: at \$\d+ each)? — \$\d+ total$/);
}
console.log(`Verified ${products.length} P60 products, fallback math, responsive decision tiles, and exact offers`, tierCounts);
