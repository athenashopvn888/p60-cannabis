"use client";

import { formatMoney } from "../lib/pny-pos/money";
import { adjustMoney, balancePhrase, floatGapCents, floatPhrase, shortSideCents, tillBalanceRaw, type AdjustLine } from "../lib/pny-pos/tillLedger";
import styles from "./till.module.css";

function Grid({ lines, testId }: { lines: AdjustLine[]; testId: string }) {
  return (
    <div className={styles.adjGrid} data-testid={testId}>
      <div className={styles.adjHead}>
        <span>SKU</span>
        <span>Units</span>
        <span>$</span>
      </div>
      {lines.length === 0 ? <p className={styles.adjEmpty}>None off</p> : null}
      {lines.map((line) => {
        const tone = line.units < 0 ? styles.offShort : line.units > 0 ? styles.offOver : styles.offEven;
        const units = line.units > 0 ? `+${line.units}` : String(line.units);
        return (
          <div key={line.sku} className={styles.adjLine} data-sku={line.sku}>
            <span className={styles.offId}>{line.text}</span>
            <span className={tone}>{units}</span>
            <span className={tone}>{adjustMoney(line.cents)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TillSummary({
  cashSalesCents,
  depositedCents,
  floatCents,
  openLines,
  refillLines,
  closeLines,
  floatExpectedCents,
  floatFoundCents,
}: {
  cashSalesCents: number;
  depositedCents: number;
  floatCents: number;
  openLines: AdjustLine[];
  refillLines: AdjustLine[];
  closeLines: AdjustLine[];
  floatExpectedCents?: number | null;
  floatFoundCents?: number | null;
}) {
  const floatKnown = floatExpectedCents != null && floatFoundCents != null;
  const floatGap = floatKnown ? floatGapCents(floatExpectedCents, floatFoundCents) : 0;
  const floatLabel = floatKnown ? floatPhrase(floatGap) : null;
  const openCents = shortSideCents(openLines) + (floatKnown ? -floatGap : 0);
  const refillCents = shortSideCents(refillLines);
  const closeCents = shortSideCents(closeLines);
  const raw = tillBalanceRaw({
    cash_sales_cents: cashSalesCents,
    deposited_cents: depositedCents,
    float_cents: floatCents,
    open_cents: openCents,
    refill_cents: refillCents,
    close_cents: closeCents,
  });
  const final = balancePhrase(raw);
  const tone = (cents: number) => (cents < 0 ? styles.offShort : cents > 0 ? styles.offOver : styles.offEven);
  const finalClass = final.tone === "over" ? styles.finalOver : final.tone === "short" ? styles.finalShort : styles.offEven;

  return (
    <div data-testid="till-summary">
      <h2>Closing summary</h2>
      <div className={styles.summaryRow}><span>Cash sales</span><strong>{formatMoney(cashSalesCents)}</strong></div>
      <div className={styles.summaryRow}><span>− Deposits</span><strong>{formatMoney(depositedCents)}</strong></div>
      <div className={styles.summaryRow} data-testid="float-left"><span>− Cash on hand (float)</span><strong>{formatMoney(floatCents)}</strong></div>
      <div className={styles.summaryRow}><span>Open count</span><strong className={tone(openCents)}>{adjustMoney(openCents)}</strong></div>
      <div className={styles.summaryRow}><span>Refill count</span><strong className={tone(refillCents)}>{adjustMoney(refillCents)}</strong></div>
      <div className={styles.summaryRow}><span>Closing count</span><strong className={tone(closeCents)}>{adjustMoney(closeCents)}</strong></div>
      <div className={styles.summaryRow} data-testid="till-balance">
        <span>FINAL TILL BALANCE</span>
        <strong className={finalClass}>{final.word} {formatMoney(final.cents)}</strong>
      </div>

      <section className={styles.stockBlue} data-testid="opening-stock-check">
        <h3>Open count</h3>
        {floatLabel ? (
          <p data-testid="float-variance">Float {floatLabel.word} {formatMoney(floatLabel.cents)}</p>
        ) : null}
        <Grid lines={openLines} testId="opening-sku-list" />
      </section>
      <section className={styles.stockRose} data-testid="refill-issues">
        <h3>Refill count</h3>
        <Grid lines={refillLines} testId="refill-sku-list" />
      </section>
      <section className={styles.stockAmber} data-testid="closing-stock-check">
        <h3>Closing count</h3>
        <Grid lines={closeLines} testId="closing-sku-list" />
      </section>
    </div>
  );
}
