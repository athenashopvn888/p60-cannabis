import { currentStore } from "../../lib/pny-pos/storeContext";
import TillSummary from "../TillSummary";
import styles from "../till.module.css";

export const dynamic = "force-dynamic";

export default function ClosingSummaryPreviewPage() {
  const store = currentStore();
  return (
    <main className={styles.close} data-testid="closing-summary-preview">
      <div className={styles.closeBody}>
        <div className={styles.demo}>PREVIEW · SAMPLE VALUES · NO LIVE DATA</div>
        <div className={styles.accountantBanner} role="status">
          TAKE A PICTURE OF THIS SCREEN AND POST IT IN THE TILL GROUP FOR THE ACCOUNTANT
        </div>
        <TillSummary
          storeLabel={store.label}
          staffName="Preview Staff"
          startedAt="2026-11-10T15:00:00.000Z"
          endedAt="2026-11-10T23:30:00.000Z"
          deposits={[
            { code: `${store.depositPrefix}0041`, amountCents: 50000 },
            { code: `${store.depositPrefix}0042`, amountCents: 21000 },
          ]}
          expenseCents={0}
          cashSalesCents={69000}
          depositedCents={71000}
          floatCents={5000}
          openLines={[]}
          refillLines={[]}
          closeLines={[
            { sku: "170-3g", text: "#170 3g", units: -1, cents: -1000 },
            { sku: "188", text: "#188 pack", units: 1, cents: 500 },
          ]}
        />
        <p data-testid="shift-locked">Shift closed</p>
        <button className={styles.primary} type="button" data-testid="close-summary-done">Done, I posted it</button>
      </div>
    </main>
  );
}
