"use client";

import { useState } from "react";
import { cashGapCents, cashWord, moneyPhrase, stockNetCents, type BalanceSection } from "../lib/pny-pos/pny01Balance";
import { formatMoney } from "../lib/pny-pos/money";
import CountCard from "./CountCard";
import DepositSlip from "./DepositSlip";
import SkuOffList, { type OffLine } from "./SkuOffList";
import VerifyBanner, { useVerifyOpen } from "./VerifyBanner";
import styles from "./till.module.css";

function Tone({ cents, text }: { cents: number; text: string }) {
  const word = cashWord(cents);
  const tone = word === "OVER" ? styles.offOver : word === "SHORT" ? styles.offShort : undefined;
  return <strong className={tone}>{text}</strong>;
}

function BalanceBlock({ title, className, testId, heads, section }: {
  title: string;
  className: string;
  testId: string;
  heads: [string, string];
  section: BalanceSection;
}) {
  return (
    <section className={className} data-testid={testId}>
      <h3>{title}</h3>
      <p>{section.lines.length === 1 ? "1 SKU off" : `${section.lines.length} SKUs off`}</p>
      <div className={styles.adjHead}><span>SKU</span><span>{heads[0]}</span><span>{heads[1]}</span><span>+/−</span><span>$</span></div>
      {section.lines.map((line) => (
        <div key={line.sku} className={styles.adjRow} data-sku={line.sku}>
          <span>{line.text}</span>
          <span>{line.sheet_qty}</span>
          <span>{line.counted_qty}</span>
          <span className={line.adj < 0 ? styles.offShort : styles.offOver}>{line.adj > 0 ? `+${line.adj}` : String(line.adj)}</span>
          <span className={line.value_cents < 0 ? styles.offShort : line.value_cents > 0 ? styles.offOver : undefined}>{moneyPhrase("STOCK", line.value_cents).replace("STOCK ", "")}</span>
        </div>
      ))}
      <p><span className={styles.offShort}>STOCK SHORT {formatMoney(section.short_cents)}</span> · <span className={styles.offOver}>STOCK OVER {formatMoney(section.over_cents)}</span></p>
    </section>
  );
}

export type CloseLine = {
  sku: string;
  text?: string;
  name: string;
  price_cents: number;
  counted_qty: number | null;
};

type Totals = { sales_cents: number; cash_sales_cents: number; debit_sales_cents: number; cash_on_hand_cents: number; deposited_cents: number };

export default function CloseShift({
  lines,
  totals,
  savedDeposit,
  busy,
  error,
  onSaveCount,
  onSubmitCount,
  onSaveDeposit,
  onConfirm,
  onClose,
  stockCheck,
  deadline,
  initialStep,
  sections,
}: {
  lines: CloseLine[];
  totals: Totals;
  savedDeposit: number | null;
  busy: boolean;
  error: string;
  onSaveCount: (sku: string, counted_qty: number) => Promise<void>;
  onSubmitCount?: () => Promise<void>;
  onSaveDeposit: (cents: number) => Promise<{ deposit_code?: string | null } | void>;
  onConfirm: (depositCents: number) => Promise<void | string>;
  onClose: () => void;
  stockCheck?: {
    opening: { offCount: number; ready?: boolean; lines: OffLine[] };
    closing: { offCount: number; ready?: boolean; lines: OffLine[] };
    refills?: { count: number; lines: { sku: string; text: string; sent: number; received: number; diff: number }[] };
  };
  deadline?: string | null;
  initialStep?: "count" | "deposit";
  /** Open, refill, and closing adjustments for the summary. Display only. */
  sections?: { open: BalanceSection; refill: BalanceSection; close: BalanceSection };
}) {
  const [step, setStep] = useState<"count" | "deposit" | "slip" | "summary">(initialStep ?? (lines.length === 0 ? "deposit" : "count"));
  const [slipCode, setSlipCode] = useState<string | null>(null);
  const [deposit, setDeposit] = useState(savedDeposit == null ? "" : (savedDeposit / 100).toFixed(2));
  const [localError, setLocalError] = useState("");
  const [locking, setLocking] = useState(false);
  const [closeLabel, setCloseLabel] = useState("");
  const openingOff = (stockCheck?.opening.lines ?? []).filter((line) => line.off !== 0);
  const closingOff = (stockCheck?.closing.lines ?? []).filter((line) => line.off !== 0);

  const verifyOpen = useVerifyOpen(deadline);
  const depositCents = Math.round(Number(deposit || 0) * 100);
  const drop = Number.isFinite(depositCents) ? depositCents : 0;
  const deposited = totals.deposited_cents + drop;
  const cashGap = cashGapCents(totals.cash_sales_cents, deposited);
  const openNet = stockNetCents(sections?.open ?? { short_cents: 0, over_cents: 0 });
  const refillNet = stockNetCents(sections?.refill ?? { short_cents: 0, over_cents: 0 });
  const closeNet = stockNetCents(sections?.close ?? { short_cents: 0, over_cents: 0 });

  return (
    <section className={styles.close} data-testid="pos-close">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backLink} type="button" onClick={onClose}>Back</button>
          <div className={styles.brand}>End Shift</div>
        </div>
      </header>
      <div className={styles.closeBody}>
        {step === "count" ? (
          <>
            {verifyOpen && deadline ? <VerifyBanner deadline={deadline} /> : null}
            <CountCard
              lines={lines.map((line) => ({ sku: line.sku, text: line.text || `#${line.sku}`, counted_qty: line.counted_qty }))}
              busy={busy}
              onSave={onSaveCount}
              onSubmit={async () => {
                await onSubmitCount?.();
                setStep("deposit");
              }}
            />
          </>
        ) : null}

        {step === "deposit" ? (
          <form data-testid="close-deposit" onSubmit={(event) => {
            event.preventDefault();
            if (locking) return;
            setLocking(true);
            void onSaveDeposit(depositCents).then(async (saved) => {
              const label = await onConfirm(depositCents);
              if (typeof label === "string") setCloseLabel(label);
              const code = saved && typeof saved === "object" ? saved.deposit_code : null;
              if (code) {
                setSlipCode(code);
                setStep("slip");
              } else setStep("summary");
            }).catch((err: unknown) => {
              setLocking(false);
              setLocalError(err instanceof Error ? err.message : "Deposit was not saved");
            });
          }}>
            <h2>Final deposit</h2>
            <p>Before this drop: {moneyPhrase("Cash", cashGapCents(totals.cash_sales_cents, totals.deposited_cents))}.</p>
            <input className={styles.qtyInput} inputMode="decimal" aria-label="Final deposit" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            <button className={styles.primary} type="submit" disabled={busy || locking}>Save deposit</button>
          </form>
        ) : null}

        {step === "slip" && slipCode ? (
          <DepositSlip code={slipCode} onDone={() => setStep("summary")} />
        ) : null}

        {step === "summary" ? (
          <div data-testid="close-summary">
            <h2>Closing summary</h2>
            <div className={styles.summaryRow}><span>Cash sales</span><strong>{formatMoney(totals.cash_sales_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Debit sales</span><strong>{formatMoney(totals.debit_sales_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Total sales</span><strong>{formatMoney(totals.sales_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Earlier deposits</span><strong>{formatMoney(totals.deposited_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Final deposit</span><strong>{formatMoney(drop)}</strong></div>
            <div className={styles.summaryRow}><span>Total deposited</span><strong>{formatMoney(deposited)}</strong></div>
            <div className={styles.summaryRow} data-testid="cash-position"><span>Cash</span><Tone cents={cashGap} text={moneyPhrase("Cash", cashGap)} /></div>
            {closeLabel ? <div className={styles.summaryRow} data-testid="close-label"><span>Close label</span><strong>{closeLabel}</strong></div> : null}
            {sections ? (
              <>
                <BalanceBlock title="Open count" className={styles.stockBlue} testId="opening-stock-check" heads={["Sheet", "Count"]} section={sections.open} />
                <BalanceBlock title="Refill count" className={styles.stockRose} testId="refill-issues" heads={["Sent", "Recv"]} section={sections.refill} />
                <BalanceBlock title="Closing count" className={styles.stockAmber} testId="closing-stock-check" heads={["Due", "Count"]} section={sections.close} />
                <div className={styles.summaryRow}><span>Open stock</span><Tone cents={openNet} text={moneyPhrase("STOCK", openNet)} /></div>
                <div className={styles.summaryRow}><span>Refill stock</span><Tone cents={refillNet} text={moneyPhrase("STOCK", refillNet)} /></div>
                <div className={styles.summaryRow}><span>Closing stock</span><Tone cents={closeNet} text={moneyPhrase("STOCK", closeNet)} /></div>
                <div className={styles.summaryRow} data-testid="overall-result"><span>Overall</span><Tone cents={cashGap + openNet + refillNet + closeNet} text={moneyPhrase("Cash", cashGap + openNet + refillNet + closeNet).replace(/^Cash /, "")} /></div>
              </>
            ) : (
              <>
                <section className={styles.stockBlue} data-testid="opening-stock-check">
                  <h3>Opening verify count</h3>
                  <p>{stockCheck?.opening.ready === false ? "Count still open" : openingOff.length === 1 ? "1 SKU off" : `${openingOff.length} SKUs off`}</p>
                  <SkuOffList lines={openingOff} testId="opening-sku-list" />
                </section>
                <section className={styles.stockAmber} data-testid="closing-stock-check">
                  <h3>Closing count</h3>
                  <p>{stockCheck?.closing.ready === false ? "Count still open" : closingOff.length === 1 ? "1 SKU off" : `${closingOff.length} SKUs off`}</p>
                  <SkuOffList lines={closingOff} testId="closing-sku-list" />
                </section>
                <section className={styles.stockRose} data-testid="refill-issues">
                  <h3>Refill issues</h3>
                  <p>{(stockCheck?.refills?.count ?? 0) === 1 ? "1 refill issue" : `${stockCheck?.refills?.count ?? 0} refill issues`}</p>
                  {(stockCheck?.refills?.lines ?? []).map((line) => (
                    <div key={line.sku} className={styles.refillIssue} data-testid="refill-issue-row">
                      <div className={styles.offRow}>
                        <strong>{line.text}</strong>
                        <strong className={line.diff < 0 ? styles.offShort : line.diff > 0 ? styles.offOver : styles.offEven}>{line.diff > 0 ? `+${line.diff}` : String(line.diff)}</strong>
                      </div>
                      <p className={styles.refillMeta}>sent {line.sent} · received {line.received}</p>
                    </div>
                  ))}
                </section>
              </>
            )}
            <p data-testid="shift-locked">Shift closed</p>
          </div>
        ) : null}
        {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
      </div>
    </section>
  );
}
