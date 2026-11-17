"use client";

import { useState } from "react";
import styles from "./till.module.css";

export type PendingRefill = {
  kitchen_row_id: string;
  batch_id?: string;
  refill_id?: string;
  sent_at?: string;
  sent_by?: string;
  sku: string;
  text: string;
  qty_sent: number;
};

export type RefillReceipt = {
  refill_id: string;
  received_at: string;
  staff_name: string;
  lines: { sku: string; name: string; qty_sent: number; qty_received: number; variance_reason?: string }[];
};

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
  onReceive: (lines: { kitchen_row_id: string; qty_received: number }[]) => Promise<RefillReceipt[]>;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [receipts, setReceipts] = useState<RefillReceipt[]>([]);
  const [receiptIndex, setReceiptIndex] = useState(0);

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
    const saved = await onReceive(payload);
    setReceipts(saved);
    setReceiptIndex(0);
  }

  async function receiveAll() {
    const saved = await onReceive(lines.map((line) => ({ kitchen_row_id: line.kitchen_row_id, qty_received: line.qty_sent })));
    setReceipts(saved);
    setReceiptIndex(0);
  }

  const receipt = receipts[receiptIndex];
  if (receipt) {
    const isLast = receiptIndex === receipts.length - 1;
    return (
      <section className={styles.refillPage} data-testid="refill-receipt">
        <header className={styles.header}>
          <div className={styles.headerTop}><div className={styles.brand}>Refill received</div></div>
        </header>
        <div className={styles.refillBody}>
          <div className={styles.receiptCard}>
            <h1>{receipt.refill_id}</h1>
            <p><strong>Date:</strong> {new Date(receipt.received_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })}</p>
            <p><strong>Staff:</strong> {receipt.staff_name}</p>
            {receipt.lines.map((line) => (
              <div key={`${receipt.refill_id}-${line.sku}`} className={styles.refillRow}>
                <strong>{line.sku} {line.name}</strong>
                <span>{line.qty_received}</span>
              </div>
            ))}
            <p className={styles.photoInstruction}>Take a picture of this receipt and post it in the STOCK group.</p>
          </div>
          <button
            className={styles.primary}
            type="button"
            data-testid="refill-receipt-ok"
            onClick={() => isLast ? onClose() : setReceiptIndex((index) => index + 1)}
          >
            {isLast ? "OK - Back to POS" : "Next receipt"}
          </button>
        </div>
      </section>
    );
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
            <button className={styles.primary} type="button" data-testid="refill-received" disabled={busy} onClick={() => void receiveAll()}>Received</button>
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
