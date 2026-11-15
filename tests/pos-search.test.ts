import assert from "node:assert/strict";
import test from "node:test";
import { menuPriceText } from "../app/menu/menuPrice.ts";
import { filterSellProducts } from "../app/pos/posSearch.ts";
import { pos2Route } from "../app/pos/posPath.ts";

const rows = [
  { sku: "188", name: "PINK ANIMAL 1G IND PRE-ROLL", category: "Add Ons" },
  { sku: "500-3g", name: "EXOTIC COOKIES 3g", category: "Exotic" },
  { sku: "1002", name: "BB FULL", category: "Cigarettes" },
];

test("a search matches SKU and name in every category", () => {
  const found = filterSellProducts(rows, "188", "Exotic");
  assert.deepEqual(found.map((row) => row.sku), ["188"]);
  const named = filterSellProducts(rows, "pink animal", "Exotic");
  assert.equal(named[0]?.sku, "188");
  const cig = filterSellProducts(rows, "bb full", "Exotic");
  assert.equal(cig[0]?.sku, "1002");
});

test("clearing the search returns to the selected tab", () => {
  assert.deepEqual(filterSellProducts(rows, "", "Exotic").map((row) => row.sku), ["500-3g"]);
  assert.deepEqual(filterSellProducts(rows, "   ", "Cigarettes").map((row) => row.sku), ["1002"]);
});

test("a $2.50 cigarette pack is labeled 2 for $5 on the customer menu", () => {
  assert.equal(menuPriceText({ category: "CIGARETTES", price_cents: 250 }), "2 for $5");
  assert.equal(menuPriceText({ category: "Cigs", price_cents: 250 }), "2 for $5");
  assert.equal(menuPriceText({ category: "CIGARETTES", price_cents: 1000 }), "$10.00");
  assert.equal(menuPriceText({ category: "Add Ons", price_cents: 250 }), "$2.50");
});

test("a /pos2 path never falls back to the PNY01 till", () => {
  assert.equal(pos2Route("/pos"), null);
  assert.equal(pos2Route("/pos/till"), null);
  const route = pos2Route("/pos2");
  assert.equal(route?.apiBase, "/api/pos2");
  assert.equal(route?.label, "PNY2");
  assert.equal(route?.tillHref, "/pos2/till");
  assert.equal(route?.homeHref, "/pos2");
  assert.equal(pos2Route("/pos2/till")?.apiBase, "/api/pos2");
});
