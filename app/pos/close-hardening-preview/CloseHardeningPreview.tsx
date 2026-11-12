"use client";

import CloseShift from "../CloseShift";
import styles from "../till.module.css";

export default function CloseHardeningPreview() {
  return (
    <main className={styles.shell} data-testid="close-hardening-preview">
      <div className={styles.previewBadge}>PREVIEW · SAMPLE ONLY · NO SAVES</div>
      <CloseShift
        lines={[]}
        totals={{
          sales_cents: 73000,
          cash_sales_cents: 73000,
          debit_sales_cents: 0,
          cash_on_hand_cents: 45500,
          deposited_cents: 75000,
        }}
        savedDeposit={45500}
        busy={false}
        error=""
        onSaveCount={async () => undefined}
        onSubmitCount={async () => undefined}
        onSaveDeposit={async () => {
          const confirmed = window.confirm("$455.00 was already entered (PNY-D0017) within the last 2 minutes. Save this final deposit for the same amount?");
          if (!confirmed) throw new Error("Final deposit not saved. The last bag remains recorded.");
          return { deposit_code: "PNY-D0018" };
        }}
        onConfirm={async () => "PNY-1112-0930"}
        onClose={() => undefined}
        onDone={() => window.alert("Preview only: production will return quietly to the PIN login.")}
        weedInStore={true}
        summaryMeta={{
          storeLabel: "PNY01",
          staffName: "Yogi",
          startedAt: "2026-11-12T14:00:00.000Z",
          endedAt: "2026-11-13T02:30:00.000Z",
          deposits: [
            { code: "PNY-D0016", amountCents: 29500 },
            { code: "PNY-D0017", amountCents: 45500 },
          ],
        }}
        stockCheck={{
          opening: { offCount: 1, lines: [{ sku: "1015", text: "1015 pack", off: -2, cents: -500 }] },
          refills: { count: 1, lines: [{ sku: "240", text: "240 each", sent: 20, received: 18, diff: -2, cents: -1000 }] },
          closing: {
            offCount: 3,
            lines: [
              { sku: "1000", text: "1000 pack", off: -12, cents: -3000 },
              { sku: "1005", text: "1005 pack", off: -13, cents: -3250 },
              { sku: "701", text: "701 each", off: -6, cents: -13050 },
            ],
          },
        }}
        floatExpectedCents={10700}
        floatFoundCents={10700}
        initialStep="deposit"
        lastDeposit={{ deposit_code: "PNY-D0017", amount_cents: 45500, created_at: "2026-11-12T14:28:17.000Z" }}
      />
    </main>
  );
}
