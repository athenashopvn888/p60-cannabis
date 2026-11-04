"use client";

import { useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import styles from "./till.module.css";
import VerifyBanner from "./VerifyBanner";

export type VerifyLine = {
  sku: string;
  text: string;
  name: string;
  price_cents: number;
  counted_qty: number | null;
  locked?: boolean;
};

export default function VerifyCount({
  lines,
  deadline,
  busy,
  error,
  onSave,
  onClose,
}: {
  lines: VerifyLine[];
  deadline: string | null;
  busy: boolean;
  error: string;
  onSave: (sku: string, countedQty: number) => Promise<void>;
  onClose: () => void;
}) {
  const firstOpen = Math.max(0, lines.findIndex((line) => line.counted_qty == null && !line.locked));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [qty, setQty] = useState(lines[index]?.counted_qty == null ? "" : String(lines[index]?.counted_qty));
  const [jump, setJump] = useState("");
  const [localError, setLocalError] = useState("");
  const current = lines[index];
  const done = lines.filter((line) => line.counted_qty != null || line.locked).length;

  function show(next: number) {
    const line = lines[next];
    if (!line) return;
    setIndex(next);
    setQty(line.counted_qty == null ? "" : String(line.counted_qty));
    setLocalError("");
  }

  async function saveAndAdvance() {
    if (!current || current.locked) {
      if (index < lines.length - 1) show(index + 1);
      return;
    }
    if (!/^\d+$/.test(qty)) {
      setLocalError("Enter a whole quantity.");
      return;
    }
    setLocalError("");
    try {
      await onSave(current.sku, Number(qty));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not saved");
      return;
    }
    const later = lines.findIndex((line, lineIndex) => lineIndex > index && line.counted_qty == null && !line.locked && line.sku !== current.sku);
    const earlier = lines.findIndex((line) => line.counted_qty == null && !line.locked && line.sku !== current.sku);
    const waiting = later >= 0 ? later : earlier;
    if (waiting >= 0) show(waiting);
  }

  async function goToSku() {
    const raw = jump.trim().toLowerCase();
    const found = lines.findIndex((line) => line.sku.toLowerCase() === raw || line.text.toLowerCase() === `#${raw}` || line.text.toLowerCase().startsWith(`#${raw} `));
    if (found >= 0) {
      show(found);
      setJump("");
      return;
    }
    if (!/^\d+$/.test(qty)) {
      setLocalError("Enter the quantity, then Go, to count a SKU that shows no stock.");
      return;
    }
    setLocalError("");
    try {
      await onSave(jump.trim(), Number(qty));
      setJump("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not saved");
    }
  }

  return (
    <section className={styles.close} data-testid="pos-verify">
      {deadline ? <VerifyBanner deadline={deadline} onOpen={() => undefined} /> : null}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backLink} type="button" onClick={onClose}>Back</button>
          <div className={styles.brand}>Verify count</div>
        </div>
      </header>
      <div className={styles.closeBody}>
        <p className={styles.progress} data-testid="verify-progress">{done}/{lines.length || 0}</p>
        {current ? (
          <form onSubmit={(event) => { event.preventDefault(); void saveAndAdvance(); }}>
            <h2 className={styles.skuTitle} data-testid="verify-current">{current.text}</h2>
            <p className={styles.name}>{current.name}</p>
            <p>{formatMoney(current.price_cents)}</p>
            {current.locked ? <p>Accepted as-is</p> : (
              <input className={styles.qtyInput} inputMode="numeric" aria-label={`Count ${current.text}`} value={qty} onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ""))} autoFocus />
            )}
            <div className={styles.navRow}>
              <button className={styles.secondary} type="button" aria-label="Previous SKU" disabled={index === 0} onClick={() => show(index - 1)}>‹</button>
              <button className={styles.primary} type="submit" disabled={busy || current.locked}>Enter</button>
              <button className={styles.secondary} type="button" aria-label="Next SKU" disabled={index >= lines.length - 1} onClick={() => show(index + 1)}>›</button>
            </div>
          </form>
        ) : <p>Nothing to count.</p>}
        <div className={styles.jump}>
          <input className={styles.field} aria-label="Go to SKU" placeholder="Go to SKU #" value={jump} onChange={(event) => setJump(event.target.value)} />
          <button className={styles.secondary} type="button" onClick={() => void goToSku()}>Go</button>
        </div>
        <div data-testid="verify-order">
          {lines.map((line, lineIndex) => (
            <button key={line.sku} type="button" className={lineIndex === index ? styles.orderOn : styles.orderLine} onClick={() => show(lineIndex)}>
              {line.text}
            </button>
          ))}
        </div>
        {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
      </div>
    </section>
  );
}
