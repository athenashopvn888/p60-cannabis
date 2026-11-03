"use client";

import { useMemo, useState } from "react";
import { closingBalance, lineVariance } from "../lib/pny-pos/closing";
import { formatMoney } from "../lib/pny-pos/money";
import styles from "./till.module.css";

export type CloseLine = {
  sku: string;
  name: string;
  price_cents: number;
  opening_qty: number;
  received_qty: number;
  sold_qty: number;
  expected_qty: number;
  system_qty: number;
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
}) {
  const firstOpen = Math.max(0, lines.findIndex((line) => line.counted_qty == null));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [step, setStep] = useState<"count" | "variance" | "deposit" | "summary">(lines.length === 0 || lines.every((line) => line.counted_qty != null) ? "variance" : "count");
  const [qty, setQty] = useState(lines[index]?.counted_qty == null ? "" : String(lines[index]?.counted_qty));
  const [jump, setJump] = useState("");
  const [deposit, setDeposit] = useState(savedDeposit == null ? "" : (savedDeposit / 100).toFixed(2));
  const [localError, setLocalError] = useState("");
  const done = lines.filter((line) => line.counted_qty != null).length;
  const current = lines[index];

  const reviewed = useMemo(() => lines.map((line) => {
    const counted = line.counted_qty ?? 0;
    const variance = lineVariance({ expected_qty: line.expected_qty, counted_qty: counted, price_cents: line.price_cents });
    return { ...line, counted, ...variance };
  }), [lines]);
  const shortage = reviewed.reduce((sum, line) => sum + line.shortage_cents, 0);
  const overage = reviewed.reduce((sum, line) => sum + line.overage_cents, 0);
  const depositCents = Math.round(Number(deposit || 0) * 100);
  const deposited = totals.deposited_cents + (Number.isFinite(depositCents) ? depositCents : 0);
  const balance = closingBalance({
    cash_sales_cents: totals.cash_sales_cents,
    shortage_cents: shortage,
    overage_cents: overage,
    deposited_cents: deposited,
  });

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
      setStep("variance");
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
    else setStep("variance");
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
            ) : <p>No stock to count this shift.</p>}
            <div className={styles.jump}>
              <input className={styles.field} aria-label="Go to SKU" placeholder="Go to SKU #" value={jump} onChange={(event) => setJump(event.target.value)} />
              <button className={styles.secondary} type="button" onClick={goToSku}>Go</button>
            </div>
          </form>
        ) : null}

        {step === "variance" ? (
          <>
            <h2>Variance</h2>
            <p>Expected is opening stock plus confirmed refills, minus what was sold.</p>
            {reviewed.map((line) => (
              <article key={line.sku} className={styles.ticket}>
                <strong>{line.sku}</strong> {line.name}
                <p className={styles.meta}>Expected {line.expected_qty} · Counted {line.counted} · {line.variance_qty < 0 ? `Short ${-line.variance_qty}` : line.variance_qty > 0 ? `Over ${line.variance_qty}` : "Even"}</p>
                <p>{line.shortage_cents > 0 ? `Shortage ${formatMoney(line.shortage_cents)}` : line.overage_cents > 0 ? `Credit ${formatMoney(line.overage_cents)}` : formatMoney(0)}</p>
              </article>
            ))}
            <p>Shortage {formatMoney(shortage)} · Overage credit {formatMoney(overage)}</p>
            <button className={styles.primary} type="button" onClick={() => setStep("deposit")}>Final deposit</button>
          </>
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
            <div className={styles.summaryRow}><span>Stock shortage</span><strong>{formatMoney(shortage)}</strong></div>
            {reviewed.filter((line) => line.shortage_cents > 0).map((line) => (
              <p key={line.sku} className={styles.meta}>{line.sku} {line.name} · short {line.shortage_qty} · {formatMoney(line.shortage_cents)}</p>
            ))}
            <div className={styles.summaryRow}><span>Stock overage</span><strong>{formatMoney(overage)}</strong></div>
            <p className={styles.balance} data-testid="close-balance">{balance > 0 ? `Staff short ${formatMoney(balance)}` : balance < 0 ? `Over ${formatMoney(-balance)}` : "Even $0.00"}</p>
            <button className={styles.primary} type="button" disabled={busy || done < lines.length} onClick={() => void onConfirm(depositCents)}>Confirm & End Shift</button>
          </div>
        ) : null}
        {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
      </div>
    </section>
  );
}
