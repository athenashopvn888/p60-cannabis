import assert from "node:assert/strict";
import test from "node:test";
import { parseFarmersLinkProductPricing } from "../scripts/farmerslink-menu.mjs";

test("keeps standard weights, Prime Time, and a 2oz special separate", () => {
  const block = `
    <div class="col-12 sale-unit-bagde"><span class="container-tag-price">$140<small>/oz x2</small></span></div>
    <div class="unit-price">
      <div class="product-price half"><span class="product-price-reg">$75</span><span class="product-price-cents">14g</span></div>
      <div class="product-price oneoz"><span class="product-price-reg">$170</span><span class="product-price-cents">28g</span></div>
      <div class="product-price prime"><span class="primetime">PRIME TIME</span><span class="primedeal"><span class="product-price-reg">$140</span><span class="primeunit">/28g</span><span class="craftfree"> + 3g CRAFT COUPON</span></span></div>
    </div></span><a href="#">View Product</a>`;
  const pricing = parseFarmersLinkProductPricing(block);
  assert.deepEqual(pricing.priceOptions, [
    { key: "weight_14g", label: "14g", price: 75 },
    { key: "weight_28g", label: "28g", price: 170 },
  ]);
  assert.equal(pricing.offers[0].label, "$140/28g + 3g CRAFT COUPON");
  assert.equal(pricing.offers[1].label, "2 × 28g at $140 each — $280 total");
  assert(!pricing.offers.some((offer) => /\/oz\s*x/i.test(offer.label)));
});

test("uses exact bundle totals exposed as 2oz and 4oz prices", () => {
  const block = `
    <div class="unit-price">
      <div class="product-price oneoz"><span class="product-price-reg">$75</span><span class="product-price-cents">28g</span></div>
      <div class="product-price oneoz twooz"><span class="product-price-reg">$90</span><span class="product-price-cents">/2oz</span></div>
      <div class="product-price oneoz fouroz"><span class="product-price-reg">$160</span><span class="product-price-cents">/4oz</span></div>
    </div></span><a href="#">View Product</a>`;
  const pricing = parseFarmersLinkProductPricing(block);
  assert.deepEqual(pricing.priceOptions, [{ key: "weight_28g", label: "28g", price: 75 }]);
  assert.deepEqual(pricing.offers.map((offer) => offer.label), ["2 × 28g — $90 total", "4 × 28g — $160 total"]);
});
