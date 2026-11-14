"use client";

import { useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import { type AdjustLine } from "../lib/pny-pos/tillLedger";
import type { ScanCatalogItem } from "../lib/pny-pos/labelScan";
import CountCard from "./CountCard";
import TillSummary from "./TillSummary";
import type { OffLine } from "./SkuOffList";
import VerifyBanner, { useVerifyOpen } from "./VerifyBanner";
import styles from "./till.module.css";

export type CloseLine = { sku: string; text?: string; name: string; price_cents: number; counted_qty: number | null };
type Totals = { sales_cents: number; cash_sales_cents: number; debit_sales_cents: number; cash_on_hand_cents: number; deposited_cents: number; sale_count?: number; cigarette_packs?: number };
type CloseStep = "count" | "cash" | "review" | "confirm" | "posted";

const STEP_META = {
  count: { number: 1, title: "Closing stock count" },
  cash: { number: 2, title: "Cash & deposit" },
  review: { number: 3, title: "Shorts & refills" },
  confirm: { number: 4, title: "Confirm & post" },
} satisfies Record<Exclude<CloseStep, "posted">, { number: number; title: string }>;

export default function CloseShift({ lines, knownLines, totals, savedDeposit, busy, error, onSaveCount, onSubmitCount, onSaveDeposit, onConfirm, onClose, onDone, weedInStore, summaryMeta, stockCheck, floatExpectedCents, floatFoundCents, floatAdjustment, deadline, initialStep, resumeSummary, scanCatalog = [], previewStep, previewCountExpanded = false }: {
  lines: CloseLine[];
  knownLines?: { sku: string; text: string; counted_qty: number | null }[];
  totals: Totals;
  savedDeposit: number | null;
  busy: boolean;
  error: string;
  onSaveCount: (sku: string, counted_qty: number) => Promise<void>;
  onSubmitCount?: (confirmBlanksZero?: boolean) => Promise<void>;
  onSaveDeposit: (cents: number, floatCents: number) => Promise<{ deposit_code?: string | null } | void>;
  onConfirm: (depositCents: number, floatCents: number, finalDepositCode?: string | null) => Promise<void | string>;
  onClose: () => void;
  onDone?: () => void;
  weedInStore?: boolean | null;
  summaryMeta: { storeLabel: string; staffName: string; startedAt: string; endedAt: string | null; deposits: { code: string | null; amountCents: number }[]; finalDepositCode?: string | null };
  stockCheck?: { opening: { offCount: number; ready?: boolean; lines: OffLine[] }; closing: { offCount: number; ready?: boolean; lines: OffLine[] }; refills?: { count: number; lines: { sku: string; text: string; sent: number; received: number; diff: number; cents?: number }[] } };
  floatExpectedCents?: number | null;
  floatFoundCents?: number | null;
  floatAdjustment?: { expectedCents: number; countedCents: number; differenceCents: number; staff: string; time: string } | null;
  deadline?: string | null;
  initialStep?: "count" | "deposit";
  resumeSummary?: { depositCents: number; floatCents: number; closeLabel?: string } | null;
  scanCatalog?: ScanCatalogItem[];
  previewStep?: Exclude<CloseStep, "posted">;
  previewCountExpanded?: boolean;
}) {
  const [step, setStep] = useState<CloseStep>(previewStep ?? (resumeSummary ? "posted" : (initialStep === "deposit" || lines.length === 0 ? "cash" : "count")));
  const [countExpanded, setCountExpanded] = useState(previewCountExpanded);
  const [countSubmitSignal, setCountSubmitSignal] = useState(0);
  const [finalDepositCode, setFinalDepositCode] = useState<string | null>(summaryMeta.finalDepositCode ?? null);
  const [deposit, setDeposit] = useState(resumeSummary ? (resumeSummary.depositCents / 100).toFixed(2) : savedDeposit == null ? "" : (savedDeposit / 100).toFixed(2));
  const [floatLeft, setFloatLeft] = useState(resumeSummary ? (resumeSummary.floatCents / 100).toFixed(2) : "0.00");
  const [localError, setLocalError] = useState("");
  const [locking, setLocking] = useState(false);
  const [closeLabel, setCloseLabel] = useState(resumeSummary?.closeLabel ?? "");
  const verifyOpen = useVerifyOpen(deadline);
  const depositCents = Math.round(Number(deposit || 0) * 100);
  const drop = Number.isFinite(depositCents) ? depositCents : 0;
  const parsedFloat = Math.round(Number(floatLeft || 0) * 100);
  const floatCents = Number.isFinite(parsedFloat) && parsedFloat > 0 ? parsedFloat : 0;
  const deposited = totals.deposited_cents + drop;
  const adjust = (rows: OffLine[]): AdjustLine[] => rows.filter((line) => line.off !== 0).map((line) => ({ sku: line.sku, text: line.text, units: line.off, cents: line.cents ?? 0 }));
  const refills: AdjustLine[] = (stockCheck?.refills?.lines ?? []).filter((line) => line.diff !== 0).map((line) => ({ sku: line.sku, text: line.text, units: line.diff, cents: line.cents ?? 0 }));
  const closeLines = adjust(stockCheck?.closing.lines ?? []);
  const stockShortsCents = closeLines.reduce((sum, line) => sum + Math.max(0, -line.cents), 0);
  const stockExtraCents = closeLines.reduce((sum, line) => sum + Math.max(0, line.cents), 0);
  const summaryDeposits = [...summaryMeta.deposits, ...(drop > 0 && !(finalDepositCode && summaryMeta.deposits.some((row) => row.code === finalDepositCode)) ? [{ code: finalDepositCode, amountCents: drop }] : [])];
  const visibleMeta = step === "posted" ? { number: 4, title: "Shift posted" } : STEP_META[step];

  async function saveCashStep() {
    if (locking) return;
    setLocking(true); setLocalError("");
    try {
      const saved = await onSaveDeposit(depositCents, floatCents);
      setFinalDepositCode(saved && typeof saved === "object" ? saved.deposit_code ?? null : null);
      setStep("review");
    } catch (err) { setLocalError(err instanceof Error ? err.message : "Deposit was not saved"); }
    finally { setLocking(false); }
  }

  async function postClose() {
    if (locking) return;
    setLocking(true); setLocalError("");
    try {
      const label = await onConfirm(depositCents, floatCents, finalDepositCode);
      if (typeof label === "string") setCloseLabel(label);
      setStep("posted");
    } catch (err) { setLocalError(err instanceof Error ? err.message : "Shift was not posted"); setLocking(false); }
  }

  function goBack() {
    if (step === "count") onClose();
    else if (step === "cash") setStep("count");
    else if (step === "review") setStep("cash");
    else if (step === "confirm") setStep("review");
  }

  return <section className={styles.close} data-testid="pos-close" data-close-step={step}>
    <header className={styles.closeTop} data-testid="close-fixed-top">
      <div><strong>{summaryMeta.storeLabel}</strong><span> · {summaryMeta.staffName}</span></div>
      <div><strong>{visibleMeta.title}</strong><small>Step {visibleMeta.number} of 4</small></div>
      <strong className={styles.closeTest}>TEST STORE</strong>
    </header>
    <div className={styles.closeBody} data-testid="close-scroll-middle">
      {step === "count" ? <>{verifyOpen && deadline ? <VerifyBanner deadline={deadline} /> : null}<CountCard
        lines={lines.map((line) => ({ sku: line.sku, text: line.text || `#${line.sku}`, counted_qty: line.counted_qty }))}
        knownLines={knownLines} allowExtra purpose="closing" busy={busy} scanCatalog={scanCatalog}
        initialExpanded={previewCountExpanded} onExpandedChange={setCountExpanded} submitSignal={countSubmitSignal}
        onSave={onSaveCount} onSubmit={async (confirmBlanksZero) => { await onSubmitCount?.(confirmBlanksZero); setStep("cash"); }}
      /></> : null}
      {step === "cash" ? <form data-testid="close-cash" onSubmit={(event) => { event.preventDefault(); void saveCashStep(); }}>
        <h2>Cash &amp; safebox deposit</h2><p>Cash on hand before this drop is <strong>{formatMoney(totals.cash_on_hand_cents)}</strong>.</p>
        <label className={styles.fieldLabel} htmlFor="final-deposit">Final safebox deposit</label><input id="final-deposit" className={styles.qtyInput} inputMode="decimal" aria-label="Final deposit" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
        <label className={styles.fieldLabel} htmlFor="float-left">End float left in till</label><input id="float-left" className={styles.qtyInput} inputMode="decimal" aria-label="Float left in the till" data-testid="float-left-input" value={floatLeft} onChange={(event) => setFloatLeft(event.target.value)} />
        <p>The deposit is saved with the existing 2b deposit path when you tap Next.</p>
      </form> : null}
      {step === "review" ? <div data-testid="close-review"><h2>Shorts &amp; refill summary</h2>
        <section className={styles.stockAmber}><h3>Closing shorts / extra</h3><p><strong>{closeLines.length}</strong> SKU differences</p><p>Shorts {formatMoney(stockShortsCents)} · Extra {formatMoney(stockExtraCents)}</p></section>
        <section className={styles.stockRose}><h3>Refill issues</h3><p><strong>{refills.length}</strong> discrepancies</p>{refills.length === 0 ? <p>No refill discrepancy recorded</p> : refills.map((line) => <p key={line.sku}>{line.text}: {line.units > 0 ? "+" : ""}{line.units}</p>)}</section>
      </div> : null}
      {step === "confirm" ? <div data-testid="close-confirm"><div className={styles.accountantBanner} role="status">CONFIRM CLOSING</div><TillSummary weedInStore={weedInStore} storeLabel={summaryMeta.storeLabel} staffName={summaryMeta.staffName} startedAt={summaryMeta.startedAt} endedAt={summaryMeta.endedAt ?? new Date().toISOString()} closeLabel={closeLabel} deposits={summaryDeposits} totalOrders={totals.sale_count} cigarettePacks={totals.cigarette_packs} cashSalesCents={totals.cash_sales_cents} depositedCents={deposited} floatCents={floatCents} openLines={adjust(stockCheck?.opening.lines ?? [])} refillLines={refills} closeLines={closeLines} floatExpectedCents={floatExpectedCents} floatFoundCents={floatFoundCents} floatAdjustment={floatAdjustment} /></div> : null}
      {step === "posted" ? <div data-testid="close-summary"><div className={styles.accountantBanner} data-testid="close-summary-banner" role="status">TAKE A PICTURE AND POST IT IN THE TILL GROUP</div><TillSummary weedInStore={weedInStore} storeLabel={summaryMeta.storeLabel} staffName={summaryMeta.staffName} startedAt={summaryMeta.startedAt} endedAt={summaryMeta.endedAt ?? summaryMeta.startedAt} closeLabel={closeLabel} deposits={summaryDeposits} totalOrders={totals.sale_count} cigarettePacks={totals.cigarette_packs} cashSalesCents={totals.cash_sales_cents} depositedCents={deposited} floatCents={floatCents} openLines={adjust(stockCheck?.opening.lines ?? [])} refillLines={refills} closeLines={closeLines} floatExpectedCents={floatExpectedCents} floatFoundCents={floatFoundCents} floatAdjustment={floatAdjustment} /><p data-testid="shift-locked">Shift closed</p></div> : null}
      {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
    </div>
    {!(step === "count" && countExpanded) ? <footer className={styles.closeActions} data-testid="close-fixed-actions">
      {step !== "posted" ? <button type="button" className={styles.closeBack} onClick={goBack}>Back</button> : null}
      {step === "count" ? <><button type="button" className={styles.scanDisabled} disabled>SCAN</button><button type="button" className={styles.closeNext} disabled={busy} onClick={() => setCountSubmitSignal((value) => value + 1)}>Next</button></> : null}
      {step === "cash" ? <button type="button" className={styles.closeNext} disabled={busy || locking} onClick={() => void saveCashStep()}>Next</button> : null}
      {step === "review" ? <button type="button" className={styles.closeNext} onClick={() => setStep("confirm")}>Next</button> : null}
      {step === "confirm" ? <button type="button" className={styles.closePost} disabled={busy || locking} onClick={() => void postClose()}>Confirm &amp; Post</button> : null}
      {step === "posted" ? <button type="button" className={styles.closePost} data-testid="close-summary-done" onClick={() => (onDone ? onDone() : onClose())}>Done, I posted it</button> : null}
    </footer> : null}
  </section>;
}
