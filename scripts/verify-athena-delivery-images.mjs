import assert from "node:assert/strict";

const storeId = "P60";
const storefrontBaseUrl = "https://www.p60cannabis.com";
const catalogResponse = await fetch(`https://milestone-1-demo.vercel.app/api/catalog?store=${storeId}`);
assert.equal(catalogResponse.status, 200, "SOD catalog must return 200");
const catalog = await catalogResponse.json();
assert.equal(catalog.products?.length, 63, "SOD catalog must return 63 products");
assert(catalog.products.every((product) => product.images?.length > 0), "Every product must have a primary image");

const imageUrls = catalog.products.flatMap((product) => product.images);
assert.equal(imageUrls.length, 66, "SOD catalog must preserve all 66 image entries");
assert(imageUrls.every((value) => {
  const url = new URL(value);
  return url.protocol === "https:"
    && url.hostname === "athena-cannabis-images.vercel.app"
    && /^\/products\/delivery\/v1\/delivery-v1-[a-f0-9]{24}\.webp$/.test(url.pathname)
    && !url.search;
}), "Every catalog image must use the versioned Athena static path");

const uniqueImageUrls = [...new Set(imageUrls)];
assert.equal(uniqueImageUrls.length, 65, "The one duplicate image must remain content-deduplicated");
for (const [index, imageUrl] of uniqueImageUrls.entries()) {
  const response = await fetch(imageUrl);
  assert.equal(response.status, 200, `Athena image ${index} must return 200`);
  assert.equal(String(response.headers.get("content-type") || "").split(";")[0], "image/webp");
  const cacheControl = response.headers.get("cache-control") || "";
  assert.match(cacheControl, /max-age=31536000/);
  assert.match(cacheControl, /immutable/);
  assert.ok(Number(response.headers.get("content-length") || 0) > 0);
}

const deliveryResponse = await fetch(new URL("/delivery", storefrontBaseUrl));
assert.equal(deliveryResponse.status, 200, "Production delivery page must return 200");
const deliveryHtml = await deliveryResponse.text();
assert(!deliveryHtml.includes("milestone-1-demo.vercel.app/api/catalog-image"));
assert(!deliveryHtml.includes("/_next/image?url=https%3A%2F%2Fathena-cannabis-images.vercel.app"));

console.log(JSON.stringify({
  storeId,
  catalogProducts: catalog.products.length,
  catalogEntries: imageUrls.length,
  uniqueStaticImages: uniqueImageUrls.length,
  athenaHeadersVerified: uniqueImageUrls.length,
}));
