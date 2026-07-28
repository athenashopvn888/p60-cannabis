import assert from "node:assert/strict";
import { readFile, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const FARMERS_LINK_URL = "https://farmerslink.ca/";
const FLOWER_CATEGORIES = new Set(["Indica", "Indica Hybrid", "IH", "Sativa", "Sativa Hybrid"]);
const EXPECTED_CRAFT_SKUS = ["408", "409", "410", "411", "417", "420", "421", "423", "424", "425", "426", "493", "495"];

function text(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tier(sku, name) {
  const number = Number(sku);
  if (number >= 100 && number <= 199 && /\bSHREDS\b/i.test(name)) return "SHREDS";
  if (number >= 100 && number <= 299) return "Budget";
  if (number >= 300 && number <= 399) return "BC Premium";
  if (number >= 400 && number <= 499) return "CRAFTS";
  if (number >= 500 && number <= 599) return "Exotics";
  return null;
}

function optionKey(label) {
  return `weight_${label.replace(/\W+/g, "_").toLowerCase()}`;
}

export function parseFarmersLinkProductPricing(block) {
  const priceOptions = [];
  const offers = [];
  const unitPrice = block.match(/<div class="unit-price">([\s\S]*?)<\/div><\/span>\s*[\r\n]*\s*<a /)?.[1] ?? "";
  const priceBlocks = [...unitPrice.matchAll(/<div class="product-price\s+([^"]*)">([\s\S]*?)<\/div>/g)];

  for (const [, classes, body] of priceBlocks) {
    if (/\bprime\b/.test(classes)) {
      const price = Number(body.match(/product-price-reg">\$(\d+(?:\.\d+)?)/)?.[1]);
      const weight = text(body.match(/primeunit">([\s\S]*?)<\/span>/)?.[1]).replace(/^\//, "");
      const bonus = text(body.match(/craftfree">([\s\S]*?)<\/span>/)?.[1]).replace(/^\+\s*/, "");
      if (price && weight) {
        offers.push({
          kind: "prime_time",
          title: "PRIME TIME",
          price,
          weight,
          bonus,
          label: `$${price}/${weight}${bonus ? ` + ${bonus}` : ""}`,
        });
      }
      continue;
    }

    const price = Number(body.match(/product-price-reg">\$(\d+(?:\.\d+)?)/)?.[1]);
    const label = text(body.match(/product-price-cents[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    if (!price || !label) continue;

    const bundle = label.match(/^\/?(\d+)oz$/i);
    if (bundle && Number(bundle[1]) > 1) {
      const quantity = Number(bundle[1]);
      offers.push({
        kind: "multi_ounce",
        quantity,
        unitWeight: "28g",
        totalPrice: price,
        label: `${quantity} × 28g — $${price} total`,
      });
    } else if (/^\d+(?:\.\d+)?g$/i.test(label)) {
      priceOptions.push({ key: optionKey(label), label, price });
    }
  }

  const perOunceBadge = block.match(/container-tag-price[^>]*>\$(\d+(?:\.\d+)?)\s*<small>\s*\/oz\s*x(\d+)<\/small>/i);
  const nestedPerOunce = block.match(/class="poz-b">\$(\d+(?:\.\d+)?)<\/span>\s*x(\d+)oz/i);
  const badge = perOunceBadge ?? nestedPerOunce;
  if (badge) {
    const perUnitPrice = Number(badge[1]);
    const quantity = Number(badge[2]);
    if (!offers.some((offer) => offer.kind === "multi_ounce" && offer.quantity === quantity)) {
      const totalPrice = perUnitPrice * quantity;
      offers.push({
        kind: "multi_ounce",
        quantity,
        unitWeight: "28g",
        perUnitPrice,
        totalPrice,
        label: `${quantity} × 28g at $${perUnitPrice} each — $${totalPrice} total`,
      });
    }
  }

  return { priceOptions, offers };
}

export function parseFarmersLinkHomepage(html, importedAt = new Date().toISOString()) {
  const blocks = [...html.matchAll(/<li class="product-col[\s\S]*?<\/li>/g)].map((match) => match[0]);
  const products = [];

  for (const block of blocks) {
    const category = text(block.match(/category-list[\s\S]*?<a[^>]*>([^<]+)<\/a>/)?.[1]);
    if (!FLOWER_CATEGORIES.has(category)) continue;

    const title = block.match(/woocommerce-loop-product__title[\s\S]*?<span[^>]*>(\d{3})<\/span>([\s\S]*?)<\/h3>/);
    if (!title) continue;
    const sku = title[1];
    const name = text(title[2]);
    const productTier = tier(sku, name);
    if (!productTier) continue;

    const sourceProductId = Number(block.match(/\bpost-(\d+)\b/)?.[1]);
    const sourceUrl = block.match(/product-loop-title"\s+href="([^"]+)"/)?.[1];
    const image = block.match(/<div class="inner"><img[^>]+src="([^"]+)"/)?.[1] ?? null;
    const thc = block.match(/\bproduct_tag-(\d+)-thc\b/)?.[1];
    const { priceOptions, offers } = parseFarmersLinkProductPricing(block);

    products.push({
      sourceProductId,
      sku,
      name,
      category,
      thc: thc ? `${thc}%` : "",
      tier: productTier,
      priceOptions,
      offers,
      image,
      sourceUrl,
    });
  }

  const menu = {
    source: "Farmers Link public live catalog",
    sourceUrl: FARMERS_LINK_URL,
    importedAt,
    catalogScope: "Global public Farmers Link catalog; no PNY01 store dimension is exposed by the public page.",
    store: { id: "P60", code: "PNY01", name: "P60 Cannabis", pod: "POD01" },
    status: "production",
    products,
  };
  validateMenu(menu);
  return menu;
}

export function validateMenu(menu) {
  assert(menu.products.length >= 50, "Refusing to replace the last-known-good menu with an unexpectedly small catalog");
  assert.equal(new Set(menu.products.map((product) => product.sku)).size, menu.products.length, "Duplicate flower SKU");
  assert.deepEqual(
    menu.products.filter((product) => product.tier === "CRAFTS").map((product) => product.sku).sort(),
    EXPECTED_CRAFT_SKUS,
    "Farmers Link Craft SKU set changed; manual review required",
  );
  for (const product of menu.products) {
    assert(product.sourceProductId && product.sourceUrl && product.image, `Missing source identity for ${product.sku}`);
    assert(product.priceOptions.length > 0, `Missing standard price for ${product.sku}`);
    for (const option of product.priceOptions) {
      assert(/^\d+(?:\.\d+)?g$/.test(option.label), `Invalid standard weight ${option.label}`);
      assert(option.price > 0, `Invalid standard price for ${product.sku}`);
    }
    for (const offer of product.offers) {
      if (offer.kind === "multi_ounce") {
        assert.equal(offer.unitWeight, "28g");
        assert(offer.quantity >= 2 && offer.totalPrice > 0);
        assert(offer.label.includes(`$${offer.totalPrice} total`), `Bundle total omitted for ${product.sku}`);
        assert(!/\/oz\s*x/i.test(offer.label), `Ambiguous bundle label for ${product.sku}`);
      }
    }
  }
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const response = await fetch(FARMERS_LINK_URL, { headers: { "user-agent": "P60 menu verifier/1.0" } });
  assert(response.ok, `Farmers Link returned HTTP ${response.status}`);
  const menu = parseFarmersLinkHomepage(await response.text());
  const output = new URL("../app/delivery/delivery-menu.json", import.meta.url);

  if (shouldWrite) {
    const temporary = new URL("../app/delivery/delivery-menu.json.next", import.meta.url);
    await writeFile(temporary, `${JSON.stringify(menu, null, 2)}\n`, "utf8");
    await rename(temporary, output);
    console.log(`Imported ${menu.products.length} live Farmers Link flower products after validation`);
    return;
  }

  const current = JSON.parse(await readFile(output, "utf8"));
  const currentComparable = current.products.map(({ sku, name, category, priceOptions, offers, image, sourceUrl }) => ({ sku, name, category, priceOptions, offers, image, sourceUrl }));
  const liveComparable = menu.products.map(({ sku, name, category, priceOptions, offers, image, sourceUrl }) => ({ sku, name, category, priceOptions, offers, image, sourceUrl }));
  assert.deepEqual(currentComparable, liveComparable, "Saved P60 menu differs from the current Farmers Link public catalog");
  console.log(`P60 menu matches ${menu.products.length} live Farmers Link flower products`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
