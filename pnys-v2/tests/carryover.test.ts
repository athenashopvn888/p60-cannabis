import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogReconciliation, stockReconciliation } from "../src/domain/carryover";

test("catalog carryover requires exact count and checksum", () => {
  const source = [{ sku: "1", name: "A", size: "3g", tier: "AA", thc: true, priceCents: 1000 }];
  assert.equal(catalogReconciliation(source, structuredClone(source)).matches, true);
  assert.equal(catalogReconciliation(source, [{ ...source[0], priceCents: 1100 }]).matches, false);
});

test("stock carryover requires exact per-SKU values and total units", () => {
  const source = [{ sku: "1", quantity: 3 }, { sku: "2", quantity: 4 }];
  const ok = stockReconciliation(source, structuredClone(source));
  assert.equal(ok.matches, true);
  assert.equal(ok.sourceUnits, 7);
  assert.equal(stockReconciliation(source, [{ sku: "1", quantity: 2 }, { sku: "2", quantity: 5 }]).matches, false);
});
