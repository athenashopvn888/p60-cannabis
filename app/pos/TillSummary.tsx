"use client";

import { STORE_TZ } from "../lib/pny-pos/constants";
import { formatMoney } from "../lib/pny-pos/money";
import { adjustMoney, balancePhrase, type AdjustLine } from "../lib/pny-pos/tillLedger";
import styles from "./till.module.css";

function closeDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, weekday: "short", year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
}

function closeTime(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

function Grid({ lines, testId, emptyText = "All matched" }: { lines: AdjustLine[]; testId: string; emptyText?: string }) {
  const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  return <div className={styles.adjGrid} data-testid={testId}>
    <strong className={styles.offCount}>{lines.length} {lines.length === 1 ? "SKU" : "SKUs"} off</strong>
    <div className={styles.adjHead}><span>SKU</span><span>Qty</span><span>$</span></div>
    {lines.length === 0 ? <p className={styles.adjEmpty}>{emptyText}</p> : null}
    {lines.map((line) => {
      const tone = line.units < 0 ? styles.offShort : line.units > 0 ? styles.offOver : styles.offEven;
      return <div key={line.sku} className={styles.adjLine} data-sku={line.sku}>
        <span className={styles.offId}>{line.text}</span><span className={tone}>{line.units > 0 ? `+${line.units}` : line.units}</span><span className={tone}>{adjustMoney(line.cents)}</span>
      </div>;
    })}
    {lines.length > 0 ? <div className={`${styles.adjLine} ${styles.adjTotal}`}><span>Total</span><span /><span>{adjustMoney(totalCents)}</span></div> : null}
  </div>;
}

export default function TillSummary({
  weedInStore, storeLabel, staffName, startedAt, endedAt, closeLabel, deposits, totalOrders, cigarettePacks,
  expenseCents = 0, cashSalesCents, depositedCents, floatCents, openLines, refillLines, closeLines,
  floatFoundCents, floatAdjustment,
}: {
  weedInStore?: boolean | null;
  storeLabel: string;
  staffName: string;
  startedAt: string;
  endedAt: string;
  closeLabel?: string;
  deposits: { code: string | null; amountCents: number }[];
  totalOrders?: number;
  cigarettePacks?: number;
  expenseCents?: number;
  cashSalesCents: number;
  depositedCents: number;
  floatCents: number;
  openLines: AdjustLine[];
  refillLines: AdjustLine[];
  closeLines: AdjustLine[];
  floatExpectedCents?: number | null;
  floatFoundCents?: number | null;
  floatAdjustment?: { expectedCents: number; countedCents: number; differenceCents: number; staff: string; time: string } | null;
}) {
  const stockShortsCents = closeLines.reduce((sum, line) => sum + Math.max(0, -line.cents), 0);
  const stockCreditCents = closeLines.reduce((sum, line) => sum + Math.max(0, line.cents), 0);
  const openingCashCents = floatFoundCents ?? 0;
  const expectedCashCents = openingCashCents + cashSalesCents + stockShortsCents - stockCreditCents;
  const accountedCashCents = depositedCents + expenseCents + floatCents;
  const final = balancePhrase(expectedCashCents - accountedCashCents);
  const finalClass = final.tone === "over" ? styles.finalOver : final.tone === "short" ? styles.finalShort : styles.offEven;

  return <div data-testid="till-summary">
    <div className={styles.summaryIdentity} data-testid="closing-identity">
      <div className={styles.summaryBrand}>STAFF CLOSING · {storeLabel}</div>
      <strong className={styles.summaryStaff}>{staffName}</strong>
      <span className={styles.summaryShift}>{closeDate(endedAt)} · {closeTime(startedAt)}–{closeTime(endedAt)}</span>
      <div className={styles.summaryMeta}>
        {closeLabel ? <span data-testid="close-label">Close {closeLabel}</span> : null}
        {weedInStore != null ? <span data-testid="weed-shift-answer">{weedInStore ? "WEED" : "NO WEED"}</span> : null}
      </div>
    </div>

    <h2 className={styles.summaryHeading}>Stock adjustment</h2>
    <Grid lines={closeLines} testId="closing-sku-list" />
    <div className={styles.summaryRow}><span>Stock short</span><strong>{formatMoney(stockShortsCents)}</strong></div>
    <div className={styles.summaryRow}><span>Stock credit</span><strong>{formatMoney(stockCreditCents)}</strong></div>

    <h2 className={styles.summaryHeading}>Safebox deposits</h2>
    <section className={styles.depositSummary} data-testid="closing-deposits">
      {deposits.length === 0 ? <div className={styles.summaryRow}><span>No deposits</span><strong>{formatMoney(0)}</strong></div> : deposits.map((deposit, index) => <div className={styles.summaryRow} key={`${deposit.code ?? "na"}-${index}`}><span>{deposit.code || "NO BAG #"}</span><strong>{formatMoney(deposit.amountCents)}</strong></div>)}
    </section>
    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>SAFEBOX TOTAL</span><strong>{formatMoney(depositedCents)}</strong></div>

    <h2 className={styles.summaryHeading}>Cigarette sale</h2>
    <div className={styles.summaryRow}><span>Packs</span><strong>{cigarettePacks ?? "UNAVAILABLE"}</strong></div>
    <div className={styles.summaryRow}><span>Cartons</span><strong>UNAVAILABLE</strong></div>

    <h2 className={styles.summaryHeading}>Sales summary</h2>
    <div className={styles.summaryRow}><span>Total orders</span><strong>{totalOrders ?? "UNAVAILABLE"}</strong></div>
    <div className={styles.summaryRow}><span>Cash sales</span><strong>{formatMoney(cashSalesCents)}</strong></div>

    <h2 className={styles.summaryHeading}>Reconciliation</h2>
    <div className={styles.summaryRow}><span>Opening cash</span><strong>{floatFoundCents == null ? "UNAVAILABLE" : formatMoney(openingCashCents)}</strong></div>
    <div className={styles.summaryRow}><span>Cash sales</span><strong>{formatMoney(cashSalesCents)}</strong></div>
    <div className={styles.summaryRow}><span>Stock short</span><strong>{formatMoney(stockShortsCents)}</strong></div>
    <div className={styles.summaryRow}><span>Less stock credit</span><strong>−{formatMoney(stockCreditCents)}</strong></div>
    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>EXPECTED CASH</span><strong>{floatFoundCents == null ? "UNAVAILABLE" : formatMoney(expectedCashCents)}</strong></div>
    <div className={styles.summaryRow}><span>Safebox</span><strong>{formatMoney(depositedCents)}</strong></div>
    {expenseCents !== 0 ? <div className={styles.summaryRow}><span>Cash expense</span><strong>{formatMoney(expenseCents)}</strong></div> : null}
    <div className={styles.summaryRow} data-testid="float-left"><span>Closing float</span><strong>{formatMoney(floatCents)}</strong></div>
    <div className={`${styles.summaryRow} ${styles.summaryTotal}`} data-testid="total-cash-collected"><span>CASH ACCOUNTED</span><strong>{formatMoney(accountedCashCents)}</strong></div>
    <div className={`${styles.summaryRow} ${styles.finalRow}`} data-testid="till-balance"><span>FINAL</span><strong className={finalClass}>{floatFoundCents == null ? "UNAVAILABLE" : `${final.word} ${formatMoney(final.cents)}`}</strong></div>

    {floatAdjustment ? <section className={styles.stockBlue} data-testid="opening-stock-check">
      <h3>Opening cash adjustment</h3>
      <div data-testid="opening-float-adjustment">
        <div className={styles.summaryRow}><span>Previous close</span><strong>{formatMoney(floatAdjustment.expectedCents)}</strong></div>
        <div className={styles.summaryRow}><span>Opening count</span><strong>{formatMoney(floatAdjustment.countedCents)}</strong></div>
        <div className={styles.summaryRow}><span>Difference</span><strong>{floatAdjustment.differenceCents > 0 ? "+" : "−"}{formatMoney(Math.abs(floatAdjustment.differenceCents))}</strong></div>
        <small>{floatAdjustment.staff} · {closeDate(floatAdjustment.time)} {closeTime(floatAdjustment.time)}</small>
      </div>
    </section> : null}
    {openLines.length > 0 ? <section className={styles.stockBlue}><h3>Opening stock variance</h3><Grid lines={openLines} testId="opening-sku-list" /></section> : null}
    {refillLines.length > 0 ? <section className={styles.stockRose} data-testid="refill-issues"><h3>Refill issues</h3><Grid lines={refillLines} testId="refill-sku-list" /></section> : null}
  </div>;
}
