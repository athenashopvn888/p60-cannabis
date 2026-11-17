"use client";

import { useState } from "react";
import { DurableCommandKeys } from "../lib/pny-pos/durableCommand";
import styles from "./PostCloseClosing.module.css";

type CloseLine = { sku: string; name: string; left: number; shortage_cents?: number; overage_cents?: number };
export type PostCloseView = {
  shift: { staff_name: string; pos_id: string; sccx_shift_id?: string; started_at: string; ended_at?: string | null };
  post_close: {
    expires_at?: string | null;
    version: number;
    reclosed: boolean;
    closing: {
      sales_total_cents: number; cash_sales_cents?: number; debit_sales_cents?: number; cash_on_hand_cents: number;
      deposited_cents: number; final_deposit_cents?: number; float_cents?: number; shortage_cents?: number; overage_cents?: number;
      closing_lines: CloseLine[]; close_label?: string; reclosed_at?: string | null;
    };
  };
};

type Screen = "summary" | "warning" | "edit" | "report";
const money = (cents = 0) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
const stamp = (value?: string | null) => value ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";

function Totals({ view }: { view: PostCloseView }) {
  const row = view.post_close.closing;
  return <div className={styles.money} data-testid="post-close-totals">
    <div><span>Sales</span><strong>{money(row.sales_total_cents)}</strong></div>
    <div><span>Cash sales</span><strong>{money(row.cash_sales_cents ?? row.sales_total_cents)}</strong></div>
    <div><span>Deposits</span><strong>{money(row.deposited_cents)}</strong></div>
    <div><span>Till cash</span><strong>{money(row.float_cents ?? row.cash_on_hand_cents)}</strong></div>
    <div className={styles.short}><span>Short</span><strong>{money(row.shortage_cents)}</strong></div>
    <div><span>Over</span><strong>{money(row.overage_cents)}</strong></div>
  </div>;
}

function CountTable({ lines }: { lines: CloseLine[] }) {
  return <table className={styles.counts}><thead><tr><th>SKU</th><th>Item</th><th>Count</th></tr></thead><tbody>{lines.map((line) => <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{line.name}</td><td>{line.left}</td></tr>)}</tbody></table>;
}

export default function PostCloseClosing({ view: initial, apiBase = "/api/pos", previewScreen }: { view: PostCloseView; apiBase?: string; previewScreen?: Screen }) {
  const [view, setView] = useState(initial);
  const [screen, setScreen] = useState<Screen>(previewScreen ?? (initial.post_close.reclosed ? "report" : "summary"));
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(initial.post_close.closing.closing_lines.map((line) => [line.sku, String(line.left)])));
  const [deposit, setDeposit] = useState(String((initial.post_close.closing.final_deposit_cents ?? 0) / 100));
  const [floatCash, setFloatCash] = useState(String((initial.post_close.closing.float_cents ?? 0) / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keys] = useState(() => new DurableCommandKeys());

  async function startRedo() {
    setBusy(true); setError("");
    try {
      if (!previewScreen) {
        const response = await fetch(`${apiBase}/closing/redo/start`, { method: "POST", credentials: "same-origin" });
        const body = await response.json() as { error?: string; counts?: { sku: string; counted_qty: number }[]; final_deposit_cents?: number; float_cents?: number };
        if (!response.ok) throw new Error(body.error ?? "Closing could not be reopened.");
        setCounts(Object.fromEntries((body.counts ?? []).map((line) => [line.sku, String(line.counted_qty)])));
        setDeposit(String((body.final_deposit_cents ?? 0) / 100)); setFloatCash(String((body.float_cents ?? 0) / 100));
      }
      setScreen("edit");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Closing could not be reopened."); }
    finally { setBusy(false); }
  }

  async function submitRedo() {
    const body = {
      counts: view.post_close.closing.closing_lines.map((line) => ({ sku: line.sku, counted_qty: Number(counts[line.sku]) })),
      final_deposit_cents: Math.round(Number(deposit) * 100),
      float_cents: Math.round(Number(floatCash) * 100),
    };
    setBusy(true); setError("");
    try {
      if (previewScreen) { setScreen("report"); return; }
      const key = keys.key("closing-redo", body);
      const response = await fetch(`${apiBase}/closing/redo/submit`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ ...body, request_id: key }) });
      const result = await response.json() as { error?: string; closing?: PostCloseView["post_close"]["closing"]; version?: number; reclosed?: boolean };
      if (!response.ok || !result.closing) throw new Error(result.error ?? "Closing was not saved.");
      keys.complete("closing-redo", key);
      setView((current) => ({ ...current, post_close: { ...current.post_close, closing: result.closing!, version: result.version ?? current.post_close.version + 1, reclosed: true } }));
      setScreen("report");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Closing was not saved."); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch(`${apiBase}/logout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined); window.location.reload(); }
  const closing = view.post_close.closing;
  return <main className={styles.shell} data-testid="post-close-shell" data-screen={screen}>
    <header className={styles.top}><div><strong>PNYS · {view.shift.staff_name}</strong><small>{screen === "edit" ? "Redo closing" : "Your closing"}</small></div><strong className={styles.test}>TEST STORE</strong></header>
    <div className={styles.middle}>
      {screen === "summary" ? <><section className={styles.card} data-testid="post-close-summary"><h1>Closing summary</h1><p className={styles.privacy}>{view.shift.sccx_shift_id} · closed {stamp(view.shift.ended_at)} · access ends {stamp(view.post_close.expires_at)}</p><Totals view={view}/></section><section className={styles.card}><h2>Closing count</h2><CountTable lines={closing.closing_lines}/></section><p className={styles.privacy}>This login can only see your own closing. Sales, refills, Kitchen and Manager are locked.</p></> : null}
      {screen === "warning" ? <section className={styles.warning} role="alertdialog" aria-modal="true" data-testid="redo-warning"><div className={styles.warningMark}>⚠️</div><h1>Redo this close?</h1><p>Your submitted count and cash will reopen. Saving replaces the current closing with a new version. The old version stays in Manager audit.</p><p><strong>No sales or refills are available during redo.</strong></p>{error ? <p className={styles.error}>{error}</p> : null}</section> : null}
      {screen === "edit" ? <><section className={styles.card} data-testid="redo-entry"><h1>Closing count</h1><table className={styles.counts}><thead><tr><th>SKU</th><th>Item</th><th>Count</th></tr></thead><tbody>{closing.closing_lines.map((line) => <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{line.name}</td><td><input aria-label={`${line.sku} count`} inputMode="numeric" value={counts[line.sku] ?? ""} onChange={(event) => setCounts((current) => ({ ...current, [line.sku]: event.target.value.replace(/\D/g, "") }))}/></td></tr>)}</tbody></table></section><section className={styles.card}><h2>Cash</h2><label className={styles.field}><span>Final deposit</span><input inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)}/></label><label className={styles.field}><span>Till cash left</span><input inputMode="decimal" value={floatCash} onChange={(event) => setFloatCash(event.target.value)}/></label>{error ? <p className={styles.error}>{error}</p> : null}</section></> : null}
      {screen === "report" ? <section className={`${styles.card} ${styles.report}`} data-testid="reclosed-report"><h1 className={styles.reportTitle}>FINAL TILL REPORT</h1><div className={styles.flag}>RE-CLOSED · VERSION {view.post_close.version}</div><p><strong>{view.shift.staff_name}</strong> · {view.shift.sccx_shift_id}<br/>{stamp(closing.reclosed_at ?? view.shift.ended_at)}</p><Totals view={view}/><h2>Final count</h2><CountTable lines={closing.closing_lines}/></section> : null}
    </div>
    <footer className={styles.bottom}>
      {screen === "summary" ? <><button className={styles.secondary} type="button" onClick={() => void logout()}>Logout</button><button className={styles.danger} type="button" onClick={() => setScreen("warning")}>Redo close</button></> : null}
      {screen === "warning" ? <><button className={styles.secondary} type="button" onClick={() => setScreen("summary")}>Cancel</button><button className={styles.danger} type="button" disabled={busy} onClick={() => void startRedo()}>Yes, redo close</button></> : null}
      {screen === "edit" ? <><button className={styles.secondary} type="button" onClick={() => setScreen("summary")}>Cancel</button><button type="button" disabled={busy} onClick={() => void submitRedo()}>Submit re-close</button></> : null}
      {screen === "report" ? <button type="button" onClick={() => void logout()}>Done</button> : null}
    </footer>
  </main>;
}
