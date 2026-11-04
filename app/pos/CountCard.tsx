"use client";

import { useState } from "react";
import styles from "./till.module.css";

export type CountCardLine = {
  sku: string;
  text: string;
  counted_qty: number | null;
  locked?: boolean;
};

export default function CountCard({
  lines,
  busy,
  allowExtra,
  compact,
  onSave,
}: {
  lines: CountCardLine[];
  busy: boolean;
  allowExtra?: boolean;
  compact?: boolean;
  onSave: (sku: string, countedQty: number) => Promise<void>;
}) {
  const pending = lines.filter((line) => line.counted_qty == null && !line.locked);
  const done = lines.length - pending.length;
  const current = pending[0];
  const [qty, setQty] = useState("");
  const [seen, setSeen] = useState(current?.sku ?? "");
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extraSku, setExtraSku] = useState("");
  const [extraQty, setExtraQty] = useState("");
  const [localError, setLocalError] = useState("");

  if (!current) return null;
  if (current.sku !== seen) {
    setSeen(current.sku);
    setQty("");
  }

  const moreAfter = pending.length > 1;

  async function submitOne() {
    if (!/^\d+$/.test(qty)) {
      setLocalError("Enter a whole quantity.");
      return;
    }
    setLocalError("");
    try {
      await onSave(current.sku, Number(qty));
      setQty("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not saved");
    }
  }

  function openList() {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const line of lines) {
        if (next[line.sku] == null && line.counted_qty != null) next[line.sku] = String(line.counted_qty);
      }
      if (qty && next[current.sku] == null) next[current.sku] = qty;
      return next;
    });
    setExpanded(true);
  }

  async function submitAll() {
    setLocalError("");
    for (const line of lines) {
      if (line.locked) continue;
      const value = drafts[line.sku] ?? "";
      if (!/^\d+$/.test(value)) continue;
      if (line.counted_qty === Number(value)) continue;
      try {
        await onSave(line.sku, Number(value));
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Count was not saved");
        return;
      }
    }
  }

  async function addExtra() {
    if (!extraSku.trim() || !/^\d+$/.test(extraQty)) {
      setLocalError("Enter the SKU and a whole quantity.");
      return;
    }
    setLocalError("");
    try {
      await onSave(extraSku.trim(), Number(extraQty));
      setExtraSku("");
      setExtraQty("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not saved");
    }
  }

  const list = expanded ? (
    <div className={styles.countList} data-testid="count-list">
      {lines.map((line) => (
        <label key={line.sku} className={styles.countListRow}>
          <span>{line.text}</span>
          <input
            inputMode="numeric"
            aria-label={`Count ${line.text}`}
            value={drafts[line.sku] ?? ""}
            disabled={line.locked}
            onChange={(event) => setDrafts({ ...drafts, [line.sku]: event.target.value.replace(/[^\d]/g, "") })}
          />
        </label>
      ))}
      {allowExtra ? (
        <div className={styles.countListRow}>
          <input aria-label="Add SKU" placeholder="SKU" value={extraSku} onChange={(event) => setExtraSku(event.target.value)} />
          <input inputMode="numeric" aria-label="Add quantity" placeholder="Qty" value={extraQty} onChange={(event) => setExtraQty(event.target.value.replace(/[^\d]/g, ""))} />
          <button className={styles.countNext} type="button" disabled={busy} onClick={() => void addExtra()}>Add</button>
        </div>
      ) : null}
      <button className={styles.countNext} type="button" disabled={busy} onClick={() => void submitAll()}>Submit</button>
    </div>
  ) : null;
  const qtyInput = (
    <input
      inputMode="numeric"
      aria-label={`Count ${current.text}`}
      data-testid="count-qty"
      value={qty}
      onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ""))}
    />
  );
  const error = localError ? <p className={styles.error}>{localError}</p> : null;

  if (compact) {
    return (
      <div data-testid="count-card" className={styles.countDock}>
        {list}
        {error}
        <form className={styles.countCompact} onSubmit={(event) => { event.preventDefault(); void submitOne(); }}>
          <span className={styles.countCompactSku}>{current.text}</span>
          {qtyInput}
          <button className={styles.countNext} type="submit" disabled={busy} data-testid="count-next">{moreAfter ? "Next" : "Submit"}</button>
          <button className={styles.countExpand} type="button" data-testid="count-expand" onClick={() => (expanded ? setExpanded(false) : openList())}>
            <span>{expanded ? "Collapse" : "Expand"}</span>
            <small data-testid="count-progress">{done + 1} of {lines.length}</small>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div data-testid="count-card">
      <div className={styles.countSplit}>
        <form className={styles.countMain} onSubmit={(event) => { event.preventDefault(); void submitOne(); }}>
          <p className={styles.countSku}>{current.text}</p>
          <div className={styles.countEntry}>
            {qtyInput}
            <button className={styles.countNext} type="submit" disabled={busy} data-testid="count-next">{moreAfter ? "Next" : "Submit"}</button>
          </div>
        </form>
        <div className={styles.countSide}>
          <p className={styles.countProgress} data-testid="count-progress">{done + 1} of {lines.length}</p>
          <button className={styles.countExpand} type="button" data-testid="count-expand" onClick={() => (expanded ? setExpanded(false) : openList())}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {list}
      {error}
    </div>
  );
}
