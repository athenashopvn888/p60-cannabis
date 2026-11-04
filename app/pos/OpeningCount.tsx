"use client";

import { useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import styles from "./till.module.css";

export type OpeningLine = {
  sku: string;
  name: string;
  price_cents: number;
  counted_qty: number | null;
  variance_reason?: string | null;
};

export default function OpeningCount({
  lines,
  busy,
  error,
  onSave,
  onConfirm,
}: {
  lines: OpeningLine[];
  busy: boolean;
  error: string;
  onSave: (sku: string, counted_qty: number, variance_reason?: string) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const firstOpen = Math.max(0, lines.findIndex((line) => line.counted_qty == null));
  const [index, setIndex] = useState(firstOpen);
  const [qty, setQty] = useState(lines[index]?.counted_qty == null ? "" : String(lines[index]?.counted_qty));
  const [reason, setReason] = useState(lines[index]?.variance_reason ?? "");
  const [jump, setJump] = useState("");
  const [askReason, setAskReason] = useState(false);
  const [localError, setLocalError] = useState("");
  const done = lines.filter((line) => line.counted_qty != null).length;
  const current = lines[index];
  const entered = /^\d+$/.test(qty) ? Number(qty) : null;

  function show(next: number) {
    const line = lines[next];
    if (!line) return;
    setIndex(next);
    setQty(line.counted_qty == null ? "" : String(line.counted_qty));
    setReason(line.variance_reason ?? "");
    setAskReason(false);
    setLocalError("");
  }

  async function saveAndAdvance() {
    if (!current) return;
    if (entered == null) {
      setLocalError("Enter a whole quantity.");
      return;
    }
    setLocalError("");
    try {
      await onSave(current.sku, entered, reason.trim() || undefined);
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === "REASON_REQUIRED") setAskReason(true);
      setLocalError(code === "REASON_REQUIRED" ? "A reason is required." : err instanceof Error ? err.message : "Count was not saved");
      return;
    }
    const after = lines.findIndex((line, lineIndex) => lineIndex > index && line.counted_qty == null && line.sku !== current.sku);
    const before = lines.findIndex((line) => line.counted_qty == null && line.sku !== current.sku);
    const waiting = after >= 0 ? after : before;
    if (waiting >= 0) show(waiting);
  }

  function goToSku() {
    const raw = jump.trim();
    const found = lines.findIndex((line) => line.sku === raw);
    if (found < 0) {
      setLocalError("That SKU is not in this opening count.");
      return;
    }
    show(found);
    setJump("");
  }

  return (
    <section className={styles.close} data-testid="pos-opening">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.brand}>Opening count</div>
        </div>
      </header>
      <div className={styles.closeBody}>
        <form onSubmit={(event) => { event.preventDefault(); void saveAndAdvance(); }}>
          <p className={styles.progress} data-testid="opening-progress">{done}/{lines.length}</p>
          {current ? (
            <>
              <h2 className={styles.skuTitle}>{current.sku}</h2>
              <p className={styles.name}>{current.name}</p>
              <p>{formatMoney(current.price_cents)}</p>
              <input className={styles.qtyInput} inputMode="numeric" aria-label={`Count ${current.sku}`} value={qty} onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ""))} autoFocus />
              {askReason ? <input className={styles.field} placeholder="Reason" aria-label={`Reason for ${current.sku}`} value={reason} onChange={(event) => setReason(event.target.value)} /> : null}
              <div className={styles.navRow}>
                <button className={styles.secondary} type="button" aria-label="Previous SKU" disabled={index === 0} onClick={() => show(index - 1)}>‹</button>
                <button className={styles.primary} type="submit" disabled={busy}>Enter</button>
                <button className={styles.secondary} type="button" aria-label="Next SKU" disabled={index >= lines.length - 1} onClick={() => show(index + 1)}>›</button>
              </div>
            </>
          ) : null}
          <div className={styles.jump}>
            <input className={styles.field} aria-label="Go to SKU" placeholder="Go to SKU #" value={jump} onChange={(event) => setJump(event.target.value)} />
            <button className={styles.secondary} type="button" onClick={goToSku}>Go</button>
          </div>
        </form>
        <button className={styles.primary} type="button" disabled={busy || done < lines.length} onClick={() => void onConfirm()}>Confirm original stock</button>
        {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
      </div>
    </section>
  );
}
