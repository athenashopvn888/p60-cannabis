import assert from "node:assert/strict";
import test from "node:test";
import { balancePhrase, floatGapCents, shortSideCents, tillBalanceRaw } from "../app/lib/pny-pos/tillLedger.ts";

test("the till balance subtracts deposits and float, then the count adjustments", () => {
  const open = shortSideCents([{ cents: 4000 }, { cents: -1000 }]);
  const raw = tillBalanceRaw({
    cash_sales_cents: 53950,
    deposited_cents: 70800,
    float_cents: 0,
    open_cents: open + -floatGapCents(500, 400),
    refill_cents: shortSideCents([]),
    close_cents: shortSideCents([{ cents: 18800 }]),
  });
  assert.equal(open, -3000);
  const phrase = balancePhrase(raw);
  assert.equal(phrase.word, "OVER");
  assert.equal(phrase.cents, 53950 - 70800 - 0 - 3000 + 100 + -18800 > 0 ? 0 : -raw);
  assert.equal(raw, 53950 - 70800 - 3000 + 100 - 18800);
  assert.equal(phrase.word, raw < 0 ? "OVER" : "SHORT");
  assert.equal(phrase.cents, Math.abs(raw));
  assert.equal(balancePhrase(0).word, "EVEN");
  assert.equal(balancePhrase(250).word, "SHORT");
});
