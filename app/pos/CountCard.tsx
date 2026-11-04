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
  onJump,
  onSubmit,
}: {
  lines: CountCardLine[];
  busy: boolean;
  allowExtra?: boolean;
  compact?: boolean;
  onSave: (sku: string, countedQty: number) => Promise<void>;
  onJump?: (sku: string) => Promise<void>;
  onSubmit?: () => Promise<void>;
}) {
  const [index, setIndex] = useState(() => {
    const open = lines.findIndex((line) => line.counted_qty == null && !line.locked);
    return open < 0 ? 0 : open;
  });
  const current = lines[Math.min(index, Math.max(lines.length - 1, 0))];
  void onJump;
  const [qty, setQty] = useState(current?.counted_qty == null ? "" : String(current.counted_qty));
  const [seen, setSeen] = useState(current?.sku ?? "");
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extraSku, setExtraSku] = useState("");
  const [extraQty, setExtraQty] = useState("");
  const [localError, setLocalError] = useState("");
  const [ruleOpen, setRuleOpen] = useState(false);

  if (!current) return null;
  if (current.sku !== seen) {
    setSeen(current.sku);
    setQty(current.counted_qty == null ? (drafts[current.sku] ?? "") : String(current.counted_qty));
  }

  async function submitOne() {
    setLocalError("");
    try {
      if (/^\d+$/.test(qty)) await onSave(current.sku, Number(qty));
      if (index < lines.length - 1) setIndex(index + 1);
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

  async function jumpTo(line: CountCardLine) {
    const next = lines.findIndex((row) => row.sku === line.sku);
    setLocalError("");
    try {
      if (/^\d+$/.test(qty)) await onSave(current.sku, Number(qty));
      setIndex(next < 0 ? 0 : next);
      setExpanded(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not saved");
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
        <div key={line.sku} className={styles.countListRow}>
          <button type="button" className={styles.countJump} data-testid="count-jump" disabled={busy || line.locked} onClick={() => void jumpTo(line)}>
            {line.text}
          </button>
          <input
            inputMode="numeric"
            aria-label={`Count ${line.text}`}
            value={drafts[line.sku] ?? ""}
            disabled={line.locked}
            onChange={(event) => setDrafts({ ...drafts, [line.sku]: event.target.value.replace(/[^\d]/g, "") })}
          />
        </div>
      ))}
      {allowExtra ? (
        <div className={styles.countListRow}>
          <input aria-label="Add SKU" placeholder="SKU" value={extraSku} onChange={(event) => setExtraSku(event.target.value)} />
          <input inputMode="numeric" aria-label="Add quantity" placeholder="Qty" value={extraQty} onChange={(event) => setExtraQty(event.target.value.replace(/[^\d]/g, ""))} />
          <button className={styles.countNext} type="button" disabled={busy} onClick={() => void addExtra()}>Add</button>
        </div>
      ) : null}
      <button className={styles.countNext} type="button" disabled={busy} onClick={() => void submitAll()}>Save drafts</button>
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
  const ruleButton = (
    <button className={styles.countRuleBtn} type="button" data-testid="count-rule" onClick={() => setRuleOpen(true)}>Stock Count Rule</button>
  );
  const ruleModal = ruleOpen ? (
    <div className={styles.ruleScrim} role="dialog" aria-modal="true" aria-labelledby="count-rule-title" data-testid="count-rule-modal">
      <div className={styles.ruleSheet}>
        <h2 id="count-rule-title">Stock Count Rule</h2>
        <p>Count every SKU by bag size. You can go back and fix any SKU before you tap Submit.</p>
        <p>Selling during the count is fine. The system accounts for those sales.</p>
        <p>Tap Submit once when you are done. Any SKU you leave blank is accepted as-is, and you take responsibility for it.</p>
        <p>You have 2 hours. After that the count closes and blank SKUs are accepted.</p>
        <p>After Submit you only see SKUs that are off. + means over. − means short.</p>
        <section className={styles.ruleNotice} data-testid="count-rule-notice">
          <h3>Final report</h3>
          <p>If any quantity you enter is different from what the system expects, it will show in the final report.</p>
        </section>
        <button className={styles.primary} type="button" data-testid="count-rule-close" onClick={() => setRuleOpen(false)}>Close</button>
      </div>
    </div>
  ) : null;

  if (compact) {
    return (
      <div data-testid="count-card" className={styles.countDock}>
        <div className={styles.countRuleRow}>{ruleButton}</div>
        {list}
        {error}
        {ruleModal}
        <form className={styles.countCompact} onSubmit={(event) => { event.preventDefault(); void submitOne(); }}>
          <span className={styles.countCompactSku}>{current.text}</span>
          {qtyInput}
          <button className={styles.countNext} type="submit" disabled={busy} data-testid="count-next">Next</button>
          <button className={styles.countExpand} type="button" data-testid="count-expand" onClick={() => (expanded ? setExpanded(false) : openList())}>
            <span>{expanded ? "Collapse" : "Expand"}</span>
            <small data-testid="count-progress">{index + 1} of {lines.length}</small>
          </button>
        </form>
        {onSubmit ? <button className={styles.countSubmit} type="button" data-testid="count-submit" disabled={busy} onClick={() => void onSubmit()}>Submit</button> : null}
      </div>
    );
  }

  return (
    <div data-testid="count-card">
      <div className={styles.countRuleRow}>{ruleButton}</div>
      <div className={styles.countSplit}>
        <form className={styles.countMain} onSubmit={(event) => { event.preventDefault(); void submitOne(); }}>
          <p className={styles.countSku}>{current.text}</p>
          <div className={styles.countEntry}>
            {qtyInput}
            <button className={styles.countNext} type="submit" disabled={busy} data-testid="count-next">Next</button>
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
      {ruleModal}
    </div>
  );
}
