"use client";

import { useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import SkuOffList, { type OffLine } from "./SkuOffList";
import VerifyBanner from "./VerifyBanner";
import styles from "./till.module.css";

export type CloseLine = {
  sku: string;
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
  onSaveDeposit,
  onConfirm,
  onClose,
  stockCheck,
  deadline,
  onOpenVerify,
}: {
  lines: CloseLine[];
  totals: Totals;
  savedDeposit: number | null;
  busy: boolean;
  error: string;
  onSaveCount: (sku: string, counted_qty: number) => Promise<void>;
  onSaveDeposit: (cents: number) => Promise<void>;
  onConfirm: (depositCents: number) => Promise<void>;
  onClose: () => void;
  stockCheck?: { opening: { offCount: number; ready?: boolean; lines: OffLine[] }; closing: { offCount: number; ready?: boolean; lines: OffLine[] } };
  deadline?: string | null;
  onOpenVerify?: () => void;
}) {
  const firstOpen = Math.max(0, lines.findIndex((line) => line.counted_qty == null));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [step, setStep] = useState<"count" | "deposit" | "summary">(lines.length === 0 || lines.every((line) => line.counted_qty != null) ? "deposit" : "count");
  const [qty, setQty] = useState(lines[index]?.counted_qty == null ? "" : String(lines[index]?.counted_qty));
  const [jump, setJump] = useState("");
  const [deposit, setDeposit] = useState(savedDeposit == null ? "" : (savedDeposit / 100).toFixed(2));
  const [localError, setLocalError] = useState("");
  const done = lines.filter((line) => line.counted_qty != null).length;
  const current = lines[index];

  const depositCents = Math.round(Number(deposit || 0) * 100);
  const deposited = totals.deposited_cents + (Number.isFinite(depositCents) ? depositCents : 0);

  function show(next: number) {
    const line = lines[next];
    if (!line) return;
    setIndex(next);
    setQty(line.counted_qty == null ? "" : String(line.counted_qty));
    setLocalError("");
    setStep("count");
  }

  async function saveAndAdvance() {
    if (!current) {
      setStep("deposit");
      return;
    }
    if (!/^\d+$/.test(qty)) {
      setLocalError("Enter a whole quantity.");
      return;
    }
    setLocalError("");
    try {
      await onSaveCount(current.sku, Number(qty));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not saved");
      return;
    }
    const after = lines.findIndex((line, lineIndex) => lineIndex > index && line.counted_qty == null && line.sku !== current.sku);
    const before = lines.findIndex((line) => line.counted_qty == null && line.sku !== current.sku);
    const waiting = after >= 0 ? after : before;
    if (waiting >= 0) show(waiting);
    else setStep("deposit");
  }

  function goToSku() {
    const raw = jump.trim();
    const found = lines.findIndex((line) => line.sku === raw);
    if (found < 0) {
      setLocalError("That SKU is not in this close.");
      return;
    }
    show(found);
    setJump("");
  }

  return (
    <section className={styles.close} data-testid="pos-close">
      {deadline && onOpenVerify ? <VerifyBanner deadline={deadline} onOpen={onOpenVerify} /> : null}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backLink} type="button" onClick={onClose}>Back</button>
          <div className={styles.brand}>End Shift</div>
        </div>
      </header>
      <div className={styles.closeBody}>
        {step === "count" ? (
          <form onSubmit={(event) => { event.preventDefault(); void saveAndAdvance(); }}>
            <p className={styles.progress} data-testid="close-progress">{done}/{lines.length || 0}</p>
            {current ? (
              <>
                <h2 className={styles.skuTitle}>{current.sku}</h2>
                <p className={styles.name}>{current.name}</p>
                <p>{formatMoney(current.price_cents)}</p>
                <input className={styles.qtyInput} inputMode="numeric" aria-label={`Count ${current.sku}`} value={qty} onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ""))} autoFocus />
                <div className={styles.navRow}>
                  <button className={styles.secondary} type="button" aria-label="Previous SKU" disabled={index === 0} onClick={() => show(index - 1)}>‹</button>
                  <button className={styles.primary} type="submit" disabled={busy}>Enter</button>
                  <button className={styles.secondary} type="button" aria-label="Next SKU" disabled={index >= lines.length - 1} onClick={() => show(index + 1)}>›</button>
                </div>
              </>
            ) : <p>Nothing to count.</p>}
            <div className={styles.jump}>
              <input className={styles.field} aria-label="Go to SKU" placeholder="Go to SKU #" value={jump} onChange={(event) => setJump(event.target.value)} />
              <button className={styles.secondary} type="button" onClick={goToSku}>Go</button>
            </div>
          </form>
        ) : null}

        {step === "deposit" ? (
          <form data-testid="close-deposit" onSubmit={(event) => {
            event.preventDefault();
            void onSaveDeposit(depositCents).then(() => setStep("summary")).catch((err: unknown) => setLocalError(err instanceof Error ? err.message : "Deposit was not saved"));
          }}>
            <h2>Final deposit</h2>
            <p>Cash on hand before this drop is {formatMoney(totals.cash_on_hand_cents)}.</p>
            <input className={styles.qtyInput} inputMode="decimal" aria-label="Final deposit" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            <button className={styles.primary} type="submit" disabled={busy}>Save deposit</button>
          </form>
        ) : null}

        {step === "summary" ? (
          <div data-testid="close-summary">
            <h2>Closing summary</h2>
            <div className={styles.summaryRow}><span>Cash sales</span><strong>{formatMoney(totals.cash_sales_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Debit sales</span><strong>{formatMoney(totals.debit_sales_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Total sales</span><strong>{formatMoney(totals.sales_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Earlier deposits</span><strong>{formatMoney(totals.deposited_cents)}</strong></div>
            <div className={styles.summaryRow}><span>Final deposit</span><strong>{formatMoney(depositCents)}</strong></div>
            <div className={styles.summaryRow}><span>Total deposited</span><strong>{formatMoney(deposited)}</strong></div>
            <div className={styles.summaryRow}><span>Cash left</span><strong>{formatMoney(Math.max(0, totals.cash_on_hand_cents - depositCents))}</strong></div>
            <section className={styles.stockBlue} data-testid="opening-stock-check">
              <h3>Opening verify count</h3>
              <p>{stockCheck?.opening.ready === false ? "Count still open" : `${stockCheck?.opening.offCount ?? 0} SKUs off`}</p>
              <SkuOffList lines={stockCheck?.opening.lines ?? []} testId="opening-sku-list" />
            </section>
            <section className={styles.stockAmber} data-testid="closing-stock-check">
              <h3>Closing count</h3>
              <p>{stockCheck?.closing.ready === false ? "Count still open" : `${stockCheck?.closing.offCount ?? 0} SKUs off`}</p>
              <SkuOffList lines={stockCheck?.closing.lines ?? []} testId="closing-sku-list" />
            </section>
            <button className={styles.primary} type="button" disabled={busy || done < lines.length} onClick={() => void onConfirm(depositCents)}>Confirm & End Shift</button>
          </div>
        ) : null}
        {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
      </div>
    </section>
  );
}
