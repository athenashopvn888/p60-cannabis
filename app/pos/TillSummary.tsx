"use client";

import { STORE_TZ } from "../lib/pny-pos/constants";
import { formatMoney } from "../lib/pny-pos/money";
import { adjustMoney, balancePhrase, floatGapCents, floatPhrase, type AdjustLine } from "../lib/pny-pos/tillLedger";
import styles from "./till.module.css";

function closeDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function closeTime(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function Grid({ lines, testId, emptyText = "All matched" }: { lines: AdjustLine[]; testId: string; emptyText?: string }) {
  const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  return (
    <div className={styles.adjGrid} data-testid={testId}>
      <strong className={styles.offCount}>{lines.length} {lines.length === 1 ? "SKU" : "SKUs"} off</strong>
      <div className={styles.adjHead}>
        <span>SKU</span>
        <span>Units</span>
        <span>$</span>
      </div>
      {lines.length === 0 ? <p className={styles.adjEmpty}>{emptyText}</p> : null}
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
      {lines.length > 0 ? (
        <div className={`${styles.adjLine} ${styles.adjTotal}`}>
          <span>Total</span><span /><span className={totalCents < 0 ? styles.offShort : totalCents > 0 ? styles.offOver : styles.offEven}>{adjustMoney(totalCents)}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function TillSummary({
  weedInStore,
  storeLabel,
  staffName,
  startedAt,
  endedAt,
  closeLabel,
  deposits,
  expenseCents = 0,
  cashSalesCents,
  depositedCents,
  floatCents,
  openLines,
  refillLines,
  closeLines,
  floatExpectedCents,
  floatFoundCents,
}: {
  weedInStore?: boolean | null;
  storeLabel: string;
  staffName: string;
  startedAt: string;
  endedAt: string;
  closeLabel?: string;
  deposits: { code: string | null; amountCents: number }[];
  expenseCents?: number;
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
  // The accountant total uses the official closing differences only. Opening
  // verify and refill discrepancies remain visible below for review.
  const stockShortsCents = closeLines.reduce((sum, line) => sum + Math.max(0, -line.cents), 0);
  const stockExtraCents = closeLines.reduce((sum, line) => sum + Math.max(0, line.cents), 0);
  const totalCashCollectedCents = depositedCents + expenseCents + floatCents;
  const overShortCents = totalCashCollectedCents - cashSalesCents - stockShortsCents + stockExtraCents;
  const final = balancePhrase(-overShortCents);
  const tone = (cents: number) => (cents < 0 ? styles.offShort : cents > 0 ? styles.offOver : styles.offEven);
  const finalClass = final.tone === "over" ? styles.finalOver : final.tone === "short" ? styles.finalShort : styles.offEven;

  return (
    <div data-testid="till-summary">
      <div className={styles.summaryIdentity} data-testid="closing-identity">
        <div className={styles.summaryBrand}>P60 CANNABIS PNY&nbsp; · &nbsp;Store {storeLabel}</div>
        <strong className={styles.summaryStaff}>{staffName}</strong>
        <span className={styles.summaryShift}>{closeDate(endedAt)}&nbsp; {closeTime(startedAt)} – {closeTime(endedAt)}</span>
        <div className={styles.summaryMeta}>
          <span>Toronto time</span>
          {closeLabel ? <span data-testid="close-label">Close label {closeLabel}</span> : null}
          {weedInStore != null ? <span data-testid="weed-shift-answer">{weedInStore ? "WEED" : "NO WEED"}</span> : null}
        </div>
      </div>
      <section className={styles.summaryCheck} data-testid="closing-check">
        <h3>CHECK</h3>
        <p>TOTAL CASH COLLECTED uses recorded deposits, expense paid from store cash, and float left.</p>
        <p>{formatMoney(depositedCents)} deposits + {formatMoney(expenseCents)} expense + {formatMoney(floatCents)} float left = {formatMoney(totalCashCollectedCents)}.</p>
      </section>
      <h2 className={styles.summaryHeading}>Closing summary</h2>
      <section className={styles.depositSummary} data-testid="closing-deposits">
        <h3>Deposits</h3>
        {deposits.length === 0 ? <p>No deposit bags</p> : deposits.map((deposit, index) => (
          <div className={styles.summaryRow} key={`${deposit.code ?? "na"}-${index}`}>
            <span>{deposit.code || "No physical bag # recorded"}</span><strong>{formatMoney(deposit.amountCents)}</strong>
          </div>
        ))}
      </section>
      <div className={styles.summaryRow}><span>Total deposits</span><strong>{formatMoney(depositedCents)}</strong></div>
      <div className={styles.summaryRow}><span>Expense paid from store cash</span><strong>{expenseCents === 0 ? "none recorded  " : ""}{formatMoney(expenseCents)}</strong></div>
      <div className={styles.summaryRow} data-testid="float-left"><span>Float left</span><strong>{formatMoney(floatCents)}</strong></div>
      <div className={`${styles.summaryRow} ${styles.summaryTotal}`} data-testid="total-cash-collected"><span>TOTAL CASH COLLECTED =</span><strong>{formatMoney(totalCashCollectedCents)}</strong></div>
      <div className={styles.summaryRow}><span>less stock sold value =</span><strong>{formatMoney(cashSalesCents)}</strong></div>
      <div className={styles.summaryRow}><span>less stock shorts =</span><strong className={tone(-stockShortsCents)}>{formatMoney(stockShortsCents)}</strong></div>
      <div className={styles.summaryRow}><span>add stock extra =</span><strong className={tone(stockExtraCents)}>{formatMoney(stockExtraCents)}</strong></div>
      <div className={`${styles.summaryRow} ${styles.finalRow}`} data-testid="till-balance">
        <span>Total</span>
        <strong className={finalClass}>{final.word} {formatMoney(final.cents)}</strong>
      </div>
      <p className={styles.summaryFormula}>
        {formatMoney(totalCashCollectedCents)} cash collected − {formatMoney(cashSalesCents)} sold − {formatMoney(stockShortsCents)} shorts + {formatMoney(stockExtraCents)} extra = {final.word} {formatMoney(final.cents)}.
      </p>

      <section className={styles.stockBlue} data-testid="opening-stock-check">
        <h3>Opening Verify</h3>
        {floatLabel ? (
          <p data-testid="float-variance">Float {floatLabel.word} {formatMoney(floatLabel.cents)} (expected {formatMoney(floatExpectedCents ?? 0)}, counted {formatMoney(floatFoundCents ?? 0)})</p>
        ) : null}
        <Grid lines={openLines} testId="opening-sku-list" />
        <p className={styles.stockNote}>Opening differences are shown for review and are not included in the accountant Total above.</p>
      </section>
      <section className={styles.stockRose} data-testid="refill-issues">
        <h3>Refill Issues</h3>
        <Grid lines={refillLines} testId="refill-sku-list" emptyText="No refill discrepancy recorded" />
        <p className={styles.stockNote}>Refill issues are shown separately and are not included in the accountant Total above.</p>
      </section>
      <section className={styles.stockAmber} data-testid="closing-stock-check">
        <h3>Closing Count</h3>
        <Grid lines={closeLines} testId="closing-sku-list" />
      </section>
    </div>
  );
}
