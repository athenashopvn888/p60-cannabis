"use client";

import { useState } from "react";
import WeedShiftGate from "../WeedShiftGate";
import styles from "../till.module.css";

const NON_THC = ["710 · RAW PAPER KING SIZE", "1006 · CANADIAN FULL", "1080 · OVNS 2500"];
const THC = ["490-3g · PINK JOKER 3g", "188 · PINK ANIMAL PRE-ROLL", "800 · GAS GANG DISPO VAPE"];

export default function WeedPreview({ thcSkus }: { thcSkus: string[] }) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  if (answer == null) return <WeedShiftGate staffName="Preview Staff" busy={false} error="" onAnswer={setAnswer} />;

  const shown = answer ? [...THC, ...NON_THC] : NON_THC;
  return (
    <main className={styles.weedPreview} data-testid="weed-preview-result">
      <div className={styles.demo}>PREVIEW · SAMPLE VALUES · NO LIVE DATA</div>
      <header className={styles.weedPreviewHeader}>
        <div>
          <strong>PNY01 · Preview Staff</strong>
          <span>Saved answer: {answer ? "WEED" : "NO WEED"}</span>
        </div>
        <button type="button" className={styles.secondary} onClick={() => setAnswer(null)}>Try again</button>
      </header>

      <section className={styles.weedPreviewCard}>
        <h2>Sell screen and opening count</h2>
        <p>{answer ? "THC and non-THC SKUs use their saved on-hand." : "THC SKUs are hidden. Their saved quantities are unchanged."}</p>
        <div className={styles.weedPreviewRows}>{shown.map((row) => <div key={row}>{row}</div>)}</div>
      </section>

      <section className={styles.weedPreviewCard}>
        <h2>Refill example</h2>
        <p>490-3g +2 and 710 +5 are both received. {answer ? "Both remain visible." : "490-3g stays hidden; 710 can be sold immediately."}</p>
      </section>

      <section className={styles.weedPreviewCard}>
        <h2>Closing summary</h2>
        <div className={styles.summaryRow}><span>WEED in store this shift</span><strong>{answer ? "WEED" : "NO WEED"}</strong></div>
        <p>{answer ? "THC SKUs stay in the close plan." : "THC SKUs are excluded from this shift's close plan and carried forward unchanged."}</p>
      </section>

      <details className={styles.weedFlagList} open>
        <summary>{thcSkus.length} SKUs flagged THC for review</summary>
        <div>{thcSkus.map((sku) => <code key={sku}>{sku}</code>)}</div>
      </details>
    </main>
  );
}
