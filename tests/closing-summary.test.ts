import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { closingSummaryView } from "../app/lib/pny-pos/closingSummary.ts";
import { emptyState } from "../app/lib/pny-pos/memory.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

function endedState(): State {
  const state = emptyState("2026-11-05T12:00:00.000Z");
  state.products.push({
    sku: "170-3g",
    sku_sort: 170,
    name: "JOKERZ 3g",
    category: "BUDGET",
    default_price_cents: 1000,
    image_url: null,
    setb_active: true,
    synced_at: null,
    created_at: "2026-11-05T12:00:00.000Z",
  });
  state.shifts.push({
    id: "shift-1",
    sccx_shift_id: "pny01-test-close",
    staff_uid: "staff-test",
    store_code: "PNY01",
    ticket_letter: "A",
    ticket_seq: 0,
    pin_hash: null,
    pin_expires_at: null,
    pin_failed_attempts: 0,
    status: "ENDED",
    started_at: "2026-11-05T12:00:00.000Z",
    ended_at: "2026-11-05T18:00:00.000Z",
    end_reason: "POS_END",
    opening_confirmed_at: "2026-11-05T12:00:00.000Z",
    refill_confirmed_at: null,
    weed_gate_required: true,
    weed_in_store: false,
    weed_answered_at: "2026-11-05T12:01:00.000Z",
    weed_answered_by: "staff-test",
    created_at: "2026-11-05T12:00:00.000Z",
  });
  state.closing_drafts.push({
    shift_id: "shift-1",
    counts: [],
    opening_counts: [{ sku: "170-3g", counted_qty: 5, expected_qty: 6, accepted_as_is: false }],
    final_deposit_cents: 0,
    float_cents: 2000,
    float_found_cents: 2000,
    float_expected_cents: 2000,
    updated_at: "2026-11-05T18:00:00.000Z",
  });
  state.closings.push({
    shift_id: "shift-1",
    sales_total_cents: 8000,
    cash_sales_cents: 8000,
    debit_sales_cents: 0,
    sale_count: 1,
    void_count: 0,
    cash_on_hand_cents: 6000,
    deposited_cents: 5000,
    final_deposit_cents: 0,
    float_cents: 2000,
    shortage_cents: 0,
    overage_cents: 8000,
    balance_cents: -6000,
    tickets_total: 0,
    tickets_cashed_out: 0,
    tickets_expired: 0,
    closing_lines: [{
      sku: "105-28g",
      name: "SPACE COOKIES (SHREDS) 28g",
      left: 4,
      system_qty: 2,
      price_cents: 4000,
      expected_qty: 2,
      variance_qty: 2,
      shortage_cents: 0,
      overage_cents: 8000,
    }],
    sccx_ack_at: null,
    sccx_attempts: 0,
    no_count: false,
    summary_text: "test",
    created_at: "2026-11-05T18:00:00.000Z",
  });
  return state;
}

test("the closing summary lists off SKUs only and exposes frozen close metadata", () => {
  const view = closingSummaryView(endedState(), "pny01-test-close", "PNY01");
  assert.ok(view);
  assert.equal(view?.weedInStore, false);
  assert.equal(view?.storeLabel, "PNY01");
  assert.equal(view?.staffName, "Staff");
  assert.equal(view?.startedAt, "2026-11-05T12:00:00.000Z");
  assert.equal(view?.endedAt, "2026-11-05T18:00:00.000Z");
  assert.deepEqual(view?.deposits, []);
  assert.equal(view?.expenseCents, 0);
  assert.equal(view?.cashSalesCents, 8000);
  assert.equal(view?.depositedCents, 5000);
  assert.equal(view?.floatCents, 2000);
  assert.deepEqual(view?.openLines, [{ text: "170 3g", units: -1, cents: -1000 }]);
  assert.deepEqual(view?.refillLines, []);
  assert.equal(view?.closeLines[0]?.text, "105 28g");
  assert.equal(view?.closeLines[0]?.units, 2);
  assert.equal(view?.closeLines[0]?.cents, 8000);
  assert.equal(JSON.stringify(view).includes("Left"), false);
});

test("historical close rendering uses the shift that ended before the rendered shift", () => {
  const state = endedState();
  const draft = state.closing_drafts[0];
  if (draft) {
    draft.float_expected_cents = null;
    draft.float_found_cents = 2000;
  }
  const makeShift = (id: string, startedAt: string, endedAt: string) => ({
    ...state.shifts[0]!,
    id,
    sccx_shift_id: id,
    started_at: startedAt,
    ended_at: endedAt,
    created_at: startedAt,
  });
  state.shifts.push(
    makeShift("before", "2026-11-04T08:00:00.000Z", "2026-11-05T11:00:00.000Z"),
    makeShift("after", "2026-11-05T19:00:00.000Z", "2026-11-05T20:00:00.000Z"),
  );
  state.closings.push(
    { ...state.closings[0]!, shift_id: "before", float_cents: 1500 },
    { ...state.closings[0]!, shift_id: "after", float_cents: 9900 },
  );

  const view = closingSummaryView(state, "pny01-test-close", "PNY01");

  assert.equal(view?.floatExpectedCents, 1500);
  assert.equal(view?.floatFoundCents, 2000);
});

test("closing summary image never passes an undefined border to next/og", () => {
  const source = readFileSync(new URL("../app/lib/pny-pos/closingSummaryImage.tsx", import.meta.url), "utf8");
  assert.match(source, /borderBottom: strong \? "3px solid #1c1917" : "none"/);
  assert.doesNotMatch(source, /borderBottom:[^\n]*undefined/);
});
