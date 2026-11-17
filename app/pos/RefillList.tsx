"use client";

import { useMemo, useState } from "react";
import styles from "./till.module.css";

export type PendingRefill = {
  kitchen_row_id: string;
  batch_id: string;
  refill_id?: string;
  store_code: string;
  sku: string;
  text: string;
  name: string;
  qty_sent: number;
  kind?: string;
  sent_by: string;
  sent_at: string;
  sent_at_toronto: string;
  approval_required?: boolean;
};

export type RefillReceipt = {
  batch_id: string;
  refill_id?: string;
  status: "CONFIRMED" | "PARTIAL" | "REJECTED";
  sent_by: string;
  received_by: string;
  sent_at_toronto: string;
  received_at_toronto: string;
  signal_notice?: string;
  lines: { kitchen_row_id: string; sku: string; name: string; qty_sent: number; qty_received: number; variance: number; reason: string | null }[];
};

type ReceiveInput = {
  batch_id: string;
  action: "ACCEPT" | "REJECT";
  reason?: string;
  lines: { kitchen_row_id: string; qty_received: number; variance_reason?: string }[];
};

export default function RefillList({ lines, busy, viewOnly, onClose, onReceive }: {
  lines: PendingRefill[];
  busy: boolean;
  viewOnly?: boolean;
  onClose: () => void;
  onReceive: (input: ReceiveInput) => Promise<RefillReceipt | void>;
  scanCatalog?: unknown[];
}) {
  const batches = useMemo(() => {
    const grouped = new Map<string, PendingRefill[]>();
    for (const line of lines) grouped.set(line.batch_id, [...(grouped.get(line.batch_id) ?? []), line]);
    return [...grouped.entries()].map(([batchId, batchLines]) => ({ batchId, lines: batchLines }));
  }, [lines]);
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [rejectingBatch, setRejectingBatch] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [receipt, setReceipt] = useState<RefillReceipt | null>(null);
  const [error, setError] = useState("");

  function startEdit(batchId: string, batchLines: PendingRefill[]) {
    setQty(Object.fromEntries(batchLines.map((line) => [line.kitchen_row_id, String(line.qty_sent)])));
    setReasons({});
    setRejectingBatch(null);
    setEditingBatch(batchId);
    setError("");
  }

  async function acceptAll(batchId: string, batchLines: PendingRefill[]) {
    setError("");
    const saved = await onReceive({ batch_id: batchId, action: "ACCEPT", lines: batchLines.map((line) => ({ kitchen_row_id: line.kitchen_row_id, qty_received: line.qty_sent })) });
    if (saved) setReceipt(saved);
  }

  async function confirmEdit(batchId: string, batchLines: PendingRefill[]) {
    const payload = batchLines.map((line) => ({ kitchen_row_id: line.kitchen_row_id, qty_received: Number(qty[line.kitchen_row_id] ?? ""), variance_reason: reasons[line.kitchen_row_id]?.trim() || undefined }));
    if (payload.some((line) => !Number.isInteger(line.qty_received) || line.qty_received < 0)) { setError("Enter a whole received quantity for every SKU."); return; }
    const missingReason = payload.find((line) => line.qty_received !== batchLines.find((item) => item.kitchen_row_id === line.kitchen_row_id)?.qty_sent && !line.variance_reason);
    if (missingReason) { setError("A reason is required whenever received is different from sent."); return; }
    setError("");
    const saved = await onReceive({ batch_id: batchId, action: "ACCEPT", lines: payload });
    if (saved) setReceipt(saved);
  }

  async function rejectBatch(batchId: string) {
    if (!rejectReason.trim()) { setError("A reason is required to reject a batch."); return; }
    setError("");
    const saved = await onReceive({ batch_id: batchId, action: "REJECT", reason: rejectReason.trim(), lines: [] });
    if (saved) setReceipt(saved);
  }

  if (receipt) return <section className={styles.refillPage} data-testid="refill-receipt">
    <header className={styles.header}><div className={styles.headerTop}><div className={styles.brand}>Refill receipt</div></div></header>
    <div className={styles.refillBody}>
      <p><strong>{receipt.status}</strong> · Refill {receipt.refill_id ?? receipt.batch_id}</p>
      <p>Sent by {receipt.sent_by} · {receipt.sent_at_toronto} Toronto</p>
      <p>Received by {receipt.received_by} · {receipt.received_at_toronto} Toronto</p>
      {receipt.lines.map((line) => <article key={line.kitchen_row_id} className={styles.refillRow}><div><strong>{line.sku} · {line.name}</strong><small>Sent {line.qty_sent} · Received {line.qty_received} · Variance {line.variance}</small>{line.reason ? <small>Reason: {line.reason}</small> : null}</div></article>)}
      <p>Group notice: {receipt.signal_notice === "DRY_RUN" ? "preview dry run only" : "queued"}</p>
      <p className={styles.photoInstruction}><strong>Take a picture of this receipt and post it in the STOCK group.</strong></p>
      <button className={styles.primary} type="button" onClick={onClose}>Done, I posted it</button>
    </div>
  </section>;

  return <section className={styles.refillPage} data-testid="refill-list">
    <header className={styles.header}><div className={styles.headerTop}><button className={styles.backLink} type="button" onClick={onClose}>Back</button><div className={styles.brand}>Pending refills</div></div></header>
    <div className={styles.refillBody}>
      <button className={styles.secondary} type="button" disabled>SCAN</button>
      {batches.length === 0 ? <p>No refills waiting for this store.</p> : null}
      {batches.map((batch) => {
        const first = batch.lines[0]!;
        const editing = editingBatch === batch.batchId;
        const rejecting = rejectingBatch === batch.batchId;
        return <section key={batch.batchId} className={styles.refillBatch} data-testid="refill-batch">
          <h2>Refill {first.refill_id ?? batch.batchId}</h2><p>{first.sent_by} · {first.sent_at_toronto} Toronto</p>
          {batch.lines.map((line) => {
            const received = Number(qty[line.kitchen_row_id] ?? line.qty_sent);
            const differs = editing && Number.isInteger(received) && received !== line.qty_sent;
            return <div key={line.kitchen_row_id} className={styles.refillRow} data-testid="refill-row">
              <div><strong>{line.text}</strong><small>{line.name}</small>{line.approval_required ? <small>Store approval required</small> : null}</div>
              {editing ? <div><input className={styles.qtyInput} inputMode="numeric" aria-label={`Received ${line.text}`} value={qty[line.kitchen_row_id] ?? ""} onChange={(event) => setQty((current) => ({ ...current, [line.kitchen_row_id]: event.target.value.replace(/[^\d]/g, "") }))}/>{differs ? <input className={styles.reasonInput} aria-label={`Reason ${line.text}`} placeholder="Required reason" value={reasons[line.kitchen_row_id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [line.kitchen_row_id]: event.target.value }))}/> : null}</div> : <span>{line.qty_sent} sent</span>}
            </div>;
          })}
          {rejecting ? <div><label>Reject reason<input className={styles.reasonInput} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}/></label><button className={styles.secondary} type="button" disabled={busy} onClick={() => void rejectBatch(batch.batchId)}>Reject batch</button></div> : null}
          {!viewOnly && !editing && !rejecting ? <div className={styles.refillActions}><button className={styles.primary} type="button" disabled={busy} onClick={() => void acceptAll(batch.batchId, batch.lines)}>Accept all</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => startEdit(batch.batchId, batch.lines)}>Received quantities</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => { setEditingBatch(null); setRejectingBatch(batch.batchId); setRejectReason(""); setError(""); }}>Reject batch</button></div> : null}
          {!viewOnly && editing ? <div className={styles.refillActions}><button className={styles.primary} type="button" disabled={busy} onClick={() => void confirmEdit(batch.batchId, batch.lines)}>Save receipt</button><button className={styles.secondary} type="button" onClick={() => setEditingBatch(null)}>Cancel</button></div> : null}
        </section>;
      })}
      {error ? <p className={styles.error}>{error}</p> : null}
      {viewOnly ? <p>Master view only. Receiving is saved with the staff PIN.</p> : null}
    </div>
  </section>;
}
