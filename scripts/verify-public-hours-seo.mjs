import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

const appRoot = fileURLToPath(new URL("../app/", import.meta.url));
const files = await sourceFiles(appRoot);
const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const deliveryPage = await readFile(new URL("../app/delivery/page.tsx", import.meta.url), "utf8");
const deliveryCatalog = await readFile(new URL("../app/delivery/DeliveryCatalog.tsx", import.meta.url), "utf8");

assert(!source.includes("03:00") && !source.includes("3:00 AM"));
assert(layout.includes('"opens": "00:00"') && layout.includes('"closes": "23:59"'));
assert(source.includes("Open 24 hours daily"));
assert(deliveryPage.includes('title: { absolute: "Weed Delivery York | P60 Cannabis" }'));
assert(deliveryCatalog.includes("<h1 id=\"pny-delivery-title\">Weed Delivery in York</h1>"));
for (const area of ["York", "North York", "Vaughan", "Brampton"]) {
  assert(deliveryPage.includes(`"${area}"`));
  assert(deliveryCatalog.includes(area));
}
assert(deliveryCatalog.includes("$60 PRODUCT MINIMUM") && deliveryCatalog.includes("$10 DELIVERY FEE"));
assert(deliveryCatalog.includes("DELIVERY HOURS 10:00 a.m.–10:00 p.m."));
assert(deliveryPage.includes('opens: "10:00"') && deliveryPage.includes('closes: "22:00"'));
assert(deliveryPage.includes('minPrice: "60.00"') && deliveryPage.includes('price: "10.00"'));

const homeHtml = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
const deliveryHtml = await readFile(new URL("../.next/server/app/weed-delivery-york.html", import.meta.url), "utf8");
const storePageHtml = await readFile(new URL("../.next/server/app/weed-dispensary-york.html", import.meta.url), "utf8");
const store = jsonLd(homeHtml).find((item) => item?.["@type"] === "Store");
assert(store);
assert.equal(store.openingHoursSpecification[0].opens, "00:00");
assert.equal(store.openingHoursSpecification[0].closes, "23:59");
assert.equal(store.openingHoursSpecification[0].dayOfWeek.length, 7);
const landingStore = jsonLd(storePageHtml).find((item) => item?.["@type"] === "Store" && Array.isArray(item.openingHours));
assert(landingStore);
assert.deepEqual(landingStore.openingHours, ["Mo-Su 00:00-23:59"]);

const deliveryScripts = jsonLd(deliveryHtml).flatMap((item) => Array.isArray(item) ? item : [item]);
const service = deliveryScripts.find((item) => item?.["@type"] === "Service");
assert(service);
assert.deepEqual(service.areaServed.map((area) => area.name), ["York", "North York", "Vaughan", "Brampton"]);
assert.equal(service.hoursAvailable.opens, "10:00");
assert.equal(service.hoursAvailable.closes, "22:00");
assert.equal(service.offers.price, "10.00");
assert.equal(service.offers.eligibleTransactionVolume.minPrice, "60.00");
assert(deliveryHtml.includes("Weed Delivery in York"));
assert(deliveryHtml.includes("York, North York, Vaughan, and Brampton"));
assert(deliveryHtml.includes("<title>Weed Delivery York | P60 Cannabis</title>"));

console.log("Verified 24-hour storefront and separate 10:00-22:00 delivery SEO/schema.");
