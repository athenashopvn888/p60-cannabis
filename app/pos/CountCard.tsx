"use client";

import { useId, useState } from "react";
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
  knownLines = [],
  compact,
  purpose = "verify",
  onSave,
  onJump,
  onSubmit,
}: {
  lines: CountCardLine[];
  busy: boolean;
  allowExtra?: boolean;
  knownLines?: CountCardLine[];
  compact?: boolean;
  purpose?: "verify" | "closing";
  onSave: (sku: string, countedQty: number) => Promise<void>;
  onJump?: (sku: string) => Promise<void>;
  onSubmit?: (confirmBlanksZero?: boolean) => Promise<void>;
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
  const [blankLines, setBlankLines] = useState<CountCardLine[] | null>(null);
  const knownSkuListId = useId();

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

  async function saveTypedCounts() {
    setLocalError("");
    const typed = new Map<string, number>();
    for (const line of lines) {
      if (line.locked) continue;
      const draft = line.sku === current.sku ? qty : drafts[line.sku];
      const value = /^\d+$/.test(draft ?? "") ? draft : line.counted_qty == null ? "" : String(line.counted_qty);
      if (!/^\d+$/.test(value)) continue;
      const counted = Number(value);
      typed.set(line.sku, counted);
      if (line.counted_qty === counted) continue;
      try {
        await onSave(line.sku, counted);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Count was not saved");
        throw err;
      }
    }
    return lines.filter((line) => !line.locked && !typed.has(line.sku));
  }

  async function submitAll() {
    try {
      await saveTypedCounts();
    } catch {
      return;
    }
  }

  async function requestSubmit() {
    try {
      const blanks = await saveTypedCounts();
      if (purpose === "closing" && blanks.length) {
        setBlankLines(blanks);
        return;
      }
      await onSubmit?.(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not submitted");
    }
  }

  async function confirmBlanksAsZero() {
    setLocalError("");
    try {
      await onSubmit?.(true);
      setBlankLines(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Count was not submitted");
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
          <input
            aria-label="Search or add SKU"
            placeholder="Search SKU or name"
            list={knownSkuListId}
            value={extraSku}
            onChange={(event) => setExtraSku(event.target.value)}
          />
          <datalist id={knownSkuListId}>
            {knownLines.map((line) => <option key={line.sku} value={line.sku}>{line.text}</option>)}
          </datalist>
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
        {purpose === "closing" ? (
          <>
            <p>Count every SKU. You can change a number until you tap Submit. The count does not show what the system expects.</p>
            <p>Keep selling. Each SKU uses sales up to the last time you edited it. A sale after that edit is taken off the expected amount, so the difference stays the same.</p>
            <p>Every SKU needs a typed number. Zero is allowed. The shift cannot end until the closing count is submitted.</p>
          </>
        ) : (
          <>
            <p>Count every SKU by bag size. You can go back and fix any SKU before you tap Submit.</p>
            <p>Selling during the count is fine. The system accounts for those sales.</p>
            <p>Tap Submit once when you are done. Any SKU you leave blank is accepted as-is, and you take responsibility for it.</p>
            <p>You have 2 hours. After that the count closes and blank SKUs are accepted.</p>
            <p>After Submit you only see SKUs that are off. + means over. − means short.</p>
          </>
        )}
        <section className={styles.ruleNotice} data-testid="count-rule-notice">
          <h3>Final report</h3>
          <p>If any quantity you enter is different from what the system expects, it will show in the final report.</p>
        </section>
        <button className={styles.primary} type="button" data-testid="count-rule-close" onClick={() => setRuleOpen(false)}>Close</button>
      </div>
    </div>
  ) : null;
  const blankModal = blankLines ? (
    <div className={styles.ruleScrim} role="dialog" aria-modal="true" aria-labelledby="blank-count-title" data-testid="blank-count-modal">
      <div className={styles.ruleSheet}>
        <h2 id="blank-count-title">Closing count incomplete</h2>
        <p>{blankLines.length} items were not counted. They will be recorded as 0 (missing). Go back and count, or confirm as 0?</p>
        <ul className={styles.blankSkuList} data-testid="blank-sku-list">
          {blankLines.map((line) => <li key={line.sku}><strong>{line.sku}</strong>{line.text !== `#${line.sku}` ? ` · ${line.text}` : ""}</li>)}
        </ul>
        <div className={styles.askActions}>
          <button className={styles.primary} type="button" autoFocus data-testid="blank-go-back" onClick={() => setBlankLines(null)}>Go back and count</button>
          <button className={styles.secondary} type="button" disabled={busy} data-testid="blank-confirm-zero" onClick={() => void confirmBlanksAsZero()}>Confirm as 0</button>
        </div>
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
        {blankModal}
        <form className={styles.countCompact} onSubmit={(event) => { event.preventDefault(); void submitOne(); }}>
          <span className={styles.countCompactSku}>{current.text}</span>
          {qtyInput}
          <button className={styles.countNext} type="submit" disabled={busy} data-testid="count-next">Next</button>
          <button className={styles.countExpand} type="button" data-testid="count-expand" onClick={() => (expanded ? setExpanded(false) : openList())}>
            <span>{expanded ? "Collapse" : "Expand"}</span>
            <small data-testid="count-progress">{index + 1} of {lines.length}</small>
          </button>
        </form>
        {onSubmit ? <button className={styles.countSubmit} type="button" data-testid="count-submit" disabled={busy} onClick={() => void requestSubmit()}>Submit</button> : null}
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
          <p className={styles.countProgress} data-testid="count-progress">{index + 1} of {lines.length}</p>
          <button className={styles.countExpand} type="button" data-testid="count-expand" onClick={() => (expanded ? setExpanded(false) : openList())}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {onSubmit ? <button className={styles.countSubmit} type="button" data-testid="count-submit" disabled={busy} onClick={() => void requestSubmit()}>Submit</button> : null}
      {list}
      {error}
      {ruleModal}
      {blankModal}
    </div>
  );
}
