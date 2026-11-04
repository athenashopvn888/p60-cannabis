"use client";

import { useState } from "react";
import styles from "./till.module.css";

export type PendingRefill = { kitchen_row_id: string; sku: string; text: string; qty_sent: number };

export default function RefillList({
  lines,
  busy,
  viewOnly,
  onClose,
  onReceive,
}: {
  lines: PendingRefill[];
  busy: boolean;
  viewOnly?: boolean;
  onClose: () => void;
  onReceive: (lines: { kitchen_row_id: string; qty_received: number }[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function startEdit() {
    const next: Record<string, string> = {};
    for (const line of lines) next[line.kitchen_row_id] = String(line.qty_sent);
    setQty(next);
    setError("");
    setEditing(true);
  }

  async function confirmEdit() {
    const payload = lines.map((line) => ({ kitchen_row_id: line.kitchen_row_id, qty_received: Number(qty[line.kitchen_row_id] ?? "") }));
    if (payload.some((line) => !Number.isInteger(line.qty_received) || line.qty_received < 0)) {
      setError("Enter a whole quantity for each SKU.");
      return;
    }
    setError("");
    await onReceive(payload);
  }

  return (
    <section className={styles.refillPage} data-testid="refill-list">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <button className={styles.backLink} type="button" onClick={onClose}>Back</button>
          <div className={styles.brand}>{editing ? "Report error" : "Refill"}</div>
        </div>
      </header>
      <div className={styles.refillBody}>
        {lines.length === 0 ? <p>No refills waiting.</p> : null}
        {lines.map((line) => (
          <div key={line.kitchen_row_id} className={styles.refillRow} data-testid="refill-row">
            <strong>{line.text}</strong>
            {editing ? (
              <input
                className={styles.qtyInput}
                inputMode="numeric"
                aria-label={`Received ${line.text}`}
                value={qty[line.kitchen_row_id] ?? ""}
                onChange={(event) => setQty({ ...qty, [line.kitchen_row_id]: event.target.value.replace(/[^\d]/g, "") })}
              />
            ) : (
              <span>{line.qty_sent}</span>
            )}
          </div>
        ))}
        {error ? <p className={styles.error}>{error}</p> : null}
        {viewOnly ? <p>Master view only. Receiving is saved with the staff PIN.</p> : null}
        {lines.length > 0 && !editing && !viewOnly ? (
          <div className={styles.refillActions}>
            <button className={styles.primary} type="button" data-testid="refill-received" disabled={busy} onClick={() => void onReceive(lines.map((line) => ({ kitchen_row_id: line.kitchen_row_id, qty_received: line.qty_sent })))}>Received</button>
            <button className={styles.secondary} type="button" data-testid="refill-report" disabled={busy} onClick={startEdit}>Report error</button>
          </div>
        ) : null}
        {editing && !viewOnly ? (
          <button className={styles.primary} type="button" data-testid="refill-confirm" disabled={busy} onClick={() => void confirmEdit()}>Confirm</button>
        ) : null}
      </div>
    </section>
  );
}
