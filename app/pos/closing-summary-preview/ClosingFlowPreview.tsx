"use client";

import CloseShift from "../CloseShift";

const lines = [
  { sku: "240", text: "#240 · Preview product", name: "Preview product", price_cents: 500, counted_qty: 0 },
  { sku: "261-14g", text: "#261 14g · Daydream Diesel", name: "Daydream Diesel", price_cents: 5000, counted_qty: 3 },
  { sku: "715", text: "#715 · Cigarettes", name: "Cigarettes", price_cents: 250, counted_qty: 12 },
];

export default function ClosingFlowPreview({ step, expanded }: { step: "count" | "cash" | "review" | "confirm"; expanded: boolean }) {
  return <CloseShift
    lines={lines}
    knownLines={[...lines.map(({ sku, text, counted_qty }) => ({ sku, text, counted_qty })), { sku: "396-3g", text: "#396 3g · Zero-stock known SKU", counted_qty: null }]}
    totals={{ sales_cents: 55440, cash_sales_cents: 49000, debit_sales_cents: 6440, cash_on_hand_cents: 81340, deposited_cents: 55500 }}
    savedDeposit={25840}
    busy={false}
    error=""
    onSaveCount={async () => undefined}
    onSubmitCount={async () => undefined}
    onSaveDeposit={async () => ({ deposit_code: "PNYS-PREVIEW" })}
    onConfirm={async () => "PNYS-PREVIEW-CLOSE"}
    onClose={() => undefined}
    weedInStore
    summaryMeta={{ storeLabel: "PNYS", staffName: "Preview Staff", startedAt: "2026-11-14T01:00:00.000Z", endedAt: "2026-11-14T12:48:00.000Z", deposits: [{ code: "PNYS-0041", amountCents: 55500 }] }}
    stockCheck={{
      opening: { offCount: 1, lines: [{ sku: "715", text: "#715", off: -1, cents: -250 }] },
      closing: { offCount: 2, lines: [{ sku: "240", text: "#240", off: -1, cents: -500 }, { sku: "715", text: "#715", off: 1, cents: 250 }] },
      refills: { count: 1, lines: [{ sku: "261-14g", text: "#261 14g", sent: 4, received: 3, diff: -1, cents: -5000 }] },
    }}
    floatExpectedCents={9800}
    floatFoundCents={9800}
    scanCatalog={[]}
    previewStep={step}
    previewCountExpanded={expanded}
  />;
}
