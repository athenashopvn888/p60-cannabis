"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./pny01-refill-preview.module.css";

type Line = { sku: string; name: string; size: string; qty: number };
type Batch = { id: string; store_code: "PNY01_TEST"; sender: string; sent_at: string; status: "PENDING" | "ACCEPTED" | "PARTIAL" | "REJECTED"; lines: Line[]; receipt?: Receipt };
type Receipt = { batch_id: string; status: "ACCEPTED" | "PARTIAL" | "REJECTED"; received_at: string; received_by: string; lines: Array<Line & { received: number; variance: number; reason: string }> };
const KEY = "pnys-pny01-shadow-batches";

function readBatches(): Batch[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as Batch[]; }
  catch { return []; }
}

function toronto(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function Pny01RefillTest() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => { setBatches(readBatches()); }, []);
  const batch = useMemo(() => batches.find((row) => row.id === selected) ?? batches.find((row) => row.status === "PENDING") ?? null, [batches, selected]);

  function save(next: Batch[]) { localStorage.setItem(KEY, JSON.stringify(next)); setBatches(next); }
  function edit(row: Batch) { setSelected(row.id); setQty(Object.fromEntries(row.lines.map((line) => [line.sku, String(line.qty)]))); setReasons({}); setError(""); }
  function accept(row: Batch) {
    const lines = row.lines.map((line) => ({ ...line, received: Number(qty[line.sku] ?? line.qty), variance: Number(qty[line.sku] ?? line.qty) - line.qty, reason: reasons[line.sku]?.trim() || "" }));
    if (lines.some((line) => !Number.isInteger(line.received) || line.received < 0)) { setError("Enter a whole received quantity for every SKU."); return; }
    if (lines.some((line) => line.variance !== 0 && !line.reason)) { setError("A reason is required when received is different from sent."); return; }
    const status = lines.some((line) => line.variance !== 0) ? "PARTIAL" as const : "ACCEPTED" as const;
    const receipt: Receipt = { batch_id: row.id, status, received_at: new Date().toISOString(), received_by: "PNY01 Test Receiver", lines };
    save(batches.map((item) => item.id === row.id ? { ...item, status, receipt } : item)); setError("");
  }
  function reject(row: Batch) {
    const reason = reasons.BATCH?.trim() || "";
    if (!reason) { setError("A reason is required to reject the batch."); return; }
    const receipt: Receipt = { batch_id: row.id, status: "REJECTED", received_at: new Date().toISOString(), received_by: "PNY01 Test Receiver", lines: row.lines.map((line) => ({ ...line, received: 0, variance: -line.qty, reason })) };
    save(batches.map((item) => item.id === row.id ? { ...item, status: "REJECTED", receipt } : item)); setError("");
  }

  return <main className={styles.shell}>
    <header><strong>PNY01 TEST RECEIVER</strong><span>ISOLATED · NO LIVE STOCK</span></header>
    <section className={styles.body}>
      {!batches.length ? <p>No test refill batches on this device. Send one from PNYS Kitchen first.</p> : null}
      {batches.map((row) => <article key={row.id} className={styles.batch}>
        <h2>{row.id}</h2><p>Sent by {row.sender} · {toronto(row.sent_at)} Toronto</p><strong>{row.status}</strong>
        {row.lines.map((line) => <div key={line.sku} className={styles.line}><span>{line.sku} · {line.name}</span><strong>{line.qty} sent</strong></div>)}
        {row.status === "PENDING" ? <button type="button" onClick={() => edit(row)}>RECEIVE BATCH</button> : null}
        {row.receipt ? <section className={styles.receipt}><h3>Receipt · {row.receipt.status}</h3><p>{toronto(row.receipt.received_at)} Toronto</p>{row.receipt.lines.map((line) => <div key={line.sku}>{line.sku}: sent {line.qty}, received {line.received}, variance {line.variance}{line.reason ? ` · ${line.reason}` : ""}</div>)}</section> : null}
      </article>)}
      {batch?.status === "PENDING" && selected === batch.id ? <section className={styles.receive}><h2>Receive {batch.id}</h2>{batch.lines.map((line) => <label key={line.sku}>{line.sku} · sent {line.qty}<input inputMode="numeric" value={qty[line.sku] ?? String(line.qty)} onChange={(event) => setQty((current) => ({ ...current, [line.sku]: event.target.value.replace(/[^\d]/g, "") }))}/>{Number(qty[line.sku] ?? line.qty) !== line.qty ? <input placeholder="Required reason" value={reasons[line.sku] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [line.sku]: event.target.value }))}/> : null}</label>)}<button type="button" onClick={() => accept(batch)}>ACCEPT RECEIPT</button><label>Reject reason<input value={reasons.BATCH ?? ""} onChange={(event) => setReasons((current) => ({ ...current, BATCH: event.target.value }))}/></label><button type="button" onClick={() => reject(batch)}>REJECT BATCH</button></section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <p className={styles.notice}>This preview receiver saves the test receipt only in this browser. It never writes to pny_pos or live PNY01 stock.</p>
    </section>
  </main>;
}
