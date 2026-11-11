"use client";

import { useState } from "react";
import CountCard, { type CountCardLine } from "../CountCard";
import styles from "../till.module.css";

const START: CountCardLine[] = [
  { sku: "490-3g", text: "#490 3g", counted_qty: 4 },
  { sku: "710", text: "#710 each", counted_qty: 6 },
];

export default function OpeningFoundStockPreview() {
  const [lines, setLines] = useState(START);
  const [complete, setComplete] = useState(false);

  async function save(sku: string, countedQty: number) {
    setLines((current) => current.some((line) => line.sku === sku)
      ? current.map((line) => line.sku === sku ? { ...line, counted_qty: countedQty } : line)
      : [...current, { sku, text: `#${sku}`, counted_qty: countedQty }]);
  }

  return (
    <main className={styles.weedPreview}>
      <div className={styles.demo}>PREVIEW · SAMPLE VALUES · NO LIVE DATA</div>
      <section className={styles.weedPreviewCard}>
        <h1>Opening stock completion</h1>
        <p>Tap Submit to see the required unlisted-stock question.</p>
      </section>
      {complete ? (
        <section className={styles.weedPreviewCard} data-testid="open-stock-preview-complete">
          <h2>Open stock complete</h2>
          <p>Found SKUs would now be added as an audited opening count variance.</p>
          <button className={styles.secondary} type="button" onClick={() => setComplete(false)}>Try again</button>
        </section>
      ) : (
        <CountCard compact lines={lines} busy={false} allowExtra onSave={save} onSubmit={async () => setComplete(true)} />
      )}
    </main>
  );
}
