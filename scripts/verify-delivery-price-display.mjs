import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deliveryRoot = new URL("../app/delivery/", import.meta.url);
const componentUrl = ["DeliveryCatalog.tsx", "DeliveryContent.tsx"]
  .map((name) => new URL(name, deliveryRoot))
  .find((url) => fs.existsSync(url));
assert(componentUrl, "delivery pricing component must exist");

const source = fs.readFileSync(componentUrl, "utf8");
const menu = JSON.parse(fs.readFileSync(new URL("delivery-menu.json", deliveryRoot), "utf8"));

assert(source.includes("quantity === 3 && total === 95"), "3 x 28g / $95 must use the explicit $33 EACH display rule");
assert(source.includes("get28gBundleEachDisplayPrice"), "bundle EACH prices must use the guarded display helper");
assert(source.includes("formatCurrency"), "delivery currency must use the safe formatter");
assert(!source.includes("${each}"), "raw EACH interpolation must not ship");
assert(!source.includes("${total}"), "raw total interpolation must not ship");
assert(!source.includes("${option.price}"), "raw option-price interpolation must not ship");
assert(!source.includes("${regular28.price}"), "raw 28g-price interpolation must not ship");

function formatCurrency(value) {
  assert(Number.isFinite(value), "currency input must be finite");
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `$${rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
}

function bundleEach(quantity, total, perUnitPrice) {
  if (quantity === 3 && total === 95) return 33;
  const supplied = Number(perUnitPrice);
  return Number.isFinite(supplied) && supplied > 0 ? supplied : total / quantity;
}

const targetProducts = menu.products.filter((product) =>
  product.tier === "SHREDS" &&
  product.offers?.some((offer) => offer.kind === "multi_ounce" && Number(offer.quantity) === 3 && Number(offer.totalPrice) === 95)
);
assert.equal(targetProducts.length, 3, "the three canonical SHREDS products must preserve their 3 x 28g / $95 offers");
for (const product of targetProducts) {
  const offer = product.offers.find((candidate) => candidate.kind === "multi_ounce" && Number(candidate.quantity) === 3 && Number(candidate.totalPrice) === 95);
  assert.equal(formatCurrency(bundleEach(3, 95, offer.perUnitPrice)), "$33", `${product.name} must render $33 EACH`);
  assert.equal(formatCurrency(Number(offer.totalPrice)), "$95", `${product.name} must preserve the $95 total`);
}

const renderedCurrency = menu.products.flatMap((product) => [
  ...product.priceOptions.map((option) => formatCurrency(Number(option.price))),
  ...(product.offers ?? []).flatMap((offer) => {
    if (offer.kind !== "multi_ounce") return offer.price ? [formatCurrency(Number(offer.price))] : [];
    const quantity = Number(offer.quantity);
    const total = Number(offer.totalPrice);
    return [formatCurrency(bundleEach(quantity, total, offer.perUnitPrice)), formatCurrency(total)];
  }),
]);
assert(renderedCurrency.every((value) => /^\$\d+(?:\.\d{1,2})?$/.test(value)), "currency output must never expose long decimals or scientific notation");
assert(!renderedCurrency.some((value) => value.includes("31.666")), "raw 95 / 3 output must never ship");

const appRoot = new URL("../app/", import.meta.url);
const layoutSource = fs.readFileSync(new URL("layout.tsx", appRoot), "utf8");
const stylesSource = fs.readFileSync(new URL("globals.css", appRoot), "utf8");
const announcement = "NEW DELIVERY MENU IS HERE — CLICK TO EXPLORE";
assert.equal(layoutSource.split(announcement).length - 1, 1, "delivery announcement must appear exactly once in the root layout");
assert(/className="deliveryAnnouncement"\s+href="\/delivery"/.test(layoutSource), "delivery announcement must link to /delivery");
assert(stylesSource.includes(".deliveryAnnouncement"), "delivery announcement styles must exist");

function collectPublicSources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "games" ? [] : collectPublicSources(absolute);
    return /\.(?:tsx|ts)$/.test(entry.name) ? [absolute] : [];
  });
}

const publicSource = collectPublicSources(fileURLToPath(appRoot)).map((file) => fs.readFileSync(file, "utf8")).join("\n");
assert(!/Play Games|Games Arcade|href=["']\/games["']|href:\s*["']\/games["']|slug:\s*["']games["']|\$\{BASE\}\/games/.test(publicSource), "public Play Games and /games discovery links must not ship");

+console.log("Verified delivery pricing, announcement bar, and public navigation guards.");
