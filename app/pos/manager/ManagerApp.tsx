"use client";

import { useEffect, useState } from "react";
import styles from "./manager.module.css";

type Screen = "overview" | "stock" | "refills" | "closings" | "audit";
type Product = { sku: string; name: string; category: string; size: string; on_hand: number; price_cents: number; enabled: boolean };
type Refill = { kitchen_row_id: string; batch_id: string; sku: string; name: string; qty_sent: number; qty_received: number | null; status: string; kitchen_sent_at: string; staff_confirmed_at: string | null };
type Closing = { shift_id: string; staff_name: string; ended_at: string; sales_total_cents: number; deposited_cents: number; final_deposit_cents: number; shortage_cents: number; overage_cents: number; no_count: boolean };
type Audit = { id: string; action: string; actor: string | null; ref_type: string | null; ref_id: string | null; created_at: string };
type ManagerView = {
  authenticated: boolean;
  store_code?: string;
  live_shift?: { shift_id: string; status: string; staff_name: string; started_at: string } | null;
  today?: { date: string; sale_count: number; sales_total_cents: number; cash_cents: number; debit_cents: number };
  products?: Product[];
  refills?: Refill[];
  closings?: Closing[];
  audit_log?: Audit[];
  write_actions?: { enabled: false; reason: string };
};

const previewView: ManagerView = {
  authenticated: true,
  store_code: "PNYS",
  live_shift: { shift_id: "PNYS-1114-A", status: "ACTIVE", staff_name: "Demo Staff", started_at: "2026-11-14T01:10:00.000Z" },
  today: { date: "2026-11-14", sale_count: 14, sales_total_cents: 55440, cash_cents: 49000, debit_cents: 6440 },
  products: [
    { sku: "240", name: "Preview Product", category: "ADD ONS", size: "each", on_hand: 0, price_cents: 500, enabled: true },
    { sku: "261-14g", name: "Daydream Diesel", category: "FLOWER", size: "14g", on_hand: 3, price_cents: 6000, enabled: true },
    { sku: "721", name: "Backwoods", category: "CIGARETTES", size: "pack", on_hand: 18, price_cents: 2000, enabled: true },
  ],
  refills: [
    { kitchen_row_id: "r1", batch_id: "PNYS-K-041", sku: "240", name: "Preview Product", qty_sent: 4, qty_received: null, status: "PENDING_CONFIRM", kitchen_sent_at: "2026-11-14T02:30:00.000Z", staff_confirmed_at: null },
    { kitchen_row_id: "r2", batch_id: "PNYS-K-040", sku: "261-14g", name: "Daydream Diesel", qty_sent: 2, qty_received: 2, status: "CONFIRMED", kitchen_sent_at: "2026-11-13T20:30:00.000Z", staff_confirmed_at: "2026-11-13T20:37:00.000Z" },
  ],
  closings: [
    { shift_id: "PNYS-1113-B", staff_name: "Demo Staff", ended_at: "2026-11-13T23:55:00.000Z", sales_total_cents: 71540, deposited_cents: 55500, final_deposit_cents: 55500, shortage_cents: 500, overage_cents: 0, no_count: false },
    { shift_id: "PNYS-1112-A", staff_name: "Demo Staff", ended_at: "2026-11-12T23:50:00.000Z", sales_total_cents: 68400, deposited_cents: 52000, final_deposit_cents: 52000, shortage_cents: 0, overage_cents: 250, no_count: false },
  ],
  audit_log: [
    { id: "a1", action: "REFILL_CONFIRMED", actor: "demo-staff", ref_type: "incoming", ref_id: "PNYS-K-040", created_at: "2026-11-13T20:37:00.000Z" },
    { id: "a2", action: "CLOSING_POSTED", actor: "demo-staff", ref_type: "shift", ref_id: "PNYS-1113-B", created_at: "2026-11-13T23:55:00.000Z" },
  ],
  write_actions: { enabled: false, reason: "Backup, undo and exact-change confirmation are required before Manager writes are exposed." },
};

const labels: Record<Screen, string> = { overview: "Overview", stock: "Stock on hand", refills: "Refill history", closings: "Closing reports", audit: "Audit log" };
const money = (cents = 0) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
const stamp = (value?: string | null) => value ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "Request failed. Try again."));
  return body;
}

export default function ManagerApp({ preview }: { preview?: "login" | Screen }) {
  const isPreview = Boolean(preview);
  const [view, setView] = useState<ManagerView>(() => preview === "login" ? { authenticated: false } : isPreview ? previewView : { authenticated: false });
  const [screen, setScreen] = useState<Screen>(preview && preview !== "login" ? preview : "overview");
  const [pin, setPin] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/pos/manager/state", { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) { setView({ authenticated: false }); return; }
    setView(await readJson(response) as unknown as ManagerView);
  }

  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    void fetch("/api/pos/manager/state", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.status === 401 ? ({ authenticated: false } as ManagerView) : await readJson(response) as unknown as ManagerView)
      .then(setView)
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load Manager."); });
    return () => controller.abort();
  }, [isPreview]);

  async function signIn() {
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/manager/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ pin }) }));
      setPin(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  if (!view.authenticated) return <main className={styles.login} data-testid="manager-login">
    <section className={styles.loginCard}>
      <div className={styles.test}>TEST STORE</div><h1>PNYS Manager</h1><p>Enter the Manager PIN.</p>
      <div className={styles.pinDots} aria-label={`${pin.length} digits entered`}>{"●".repeat(pin.length) || "○ ○ ○ ○"}</div>
      <div className={styles.keypad}>{["1","2","3","4","5","6","7","8","9","Clear","0","⌫"].map((key) => <button key={key} type="button" onClick={() => setPin((value) => key === "Clear" ? "" : key === "⌫" ? value.slice(0, -1) : value.length < 6 ? value + key : value)}>{key}</button>)}</div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.signIn} type="button" disabled={busy || pin.length === 0} onClick={() => void signIn()}>Sign in</button>
    </section>
  </main>;

  const stock = (view.products ?? []).filter((row) => `${row.sku} ${row.name} ${row.size}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className={styles.shell} data-testid="manager-shell" data-manager-screen={screen}>
    <header className={styles.top}><div><strong>{view.store_code ?? "PNYS"}</strong><span> · Manager</span></div><strong>{labels[screen]}</strong><strong className={styles.test}>TEST STORE</strong></header>
    <div className={styles.middle}>
      <aside className={styles.readOnly}>READ ONLY · Price, stock and expense changes are locked until backup + undo + exact-change confirmation is available.</aside>
      {screen === "overview" ? <section data-testid="manager-overview">
        <h1>Live shift</h1>{view.live_shift ? <article className={styles.shift}><div><span>Status</span><strong>{view.live_shift.status}</strong></div><div><span>Staff</span><strong>{view.live_shift.staff_name}</strong></div><div><span>Started</span><strong>{stamp(view.live_shift.started_at)}</strong></div><div><span>Shift</span><strong>{view.live_shift.shift_id}</strong></div></article> : <p className={styles.empty}>No shift active.</p>}
        <h1>Today&apos;s sales</h1><div className={styles.cards}><article><span>Total</span><strong>{money(view.today?.sales_total_cents)}</strong><small>{view.today?.sale_count ?? 0} sales</small></article><article><span>Cash</span><strong>{money(view.today?.cash_cents)}</strong></article><article><span>Debit</span><strong>{money(view.today?.debit_cents)}</strong></article></div>
      </section> : null}
      {screen === "stock" ? <section data-testid="manager-stock"><label htmlFor="manager-stock-search">Search SKU, name or size</label><input id="manager-stock-search" className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock"/><div className={styles.list}>{stock.map((row) => <article key={row.sku}><div><strong>{row.sku} · {row.size}</strong><span>{row.name}</span><small>{money(row.price_cents)}</small></div><strong className={row.on_hand === 0 ? styles.zero : ""}>{row.on_hand}</strong></article>)}</div></section> : null}
      {screen === "refills" ? <section data-testid="manager-refills"><h1>Kitchen → staff</h1><div className={styles.list}>{(view.refills ?? []).map((row) => <article key={row.kitchen_row_id}><div><strong>{row.sku} · {row.name}</strong><span>Kitchen sent {row.qty_sent} · {stamp(row.kitchen_sent_at)}</span><small>{row.staff_confirmed_at ? `Staff confirmed ${row.qty_received ?? 0} · ${stamp(row.staff_confirmed_at)}` : "Waiting for staff confirmation"}</small></div><span className={row.staff_confirmed_at ? styles.good : styles.wait}>{row.staff_confirmed_at ? "CONFIRMED" : "PENDING"}</span></article>)}</div></section> : null}
      {screen === "closings" ? <section data-testid="manager-closings"><h1>Closing reports</h1><div className={styles.reportList}>{(view.closings ?? []).map((row) => <article key={row.shift_id}><header><strong>{row.shift_id}</strong><span>{row.staff_name} · {stamp(row.ended_at)}</span></header><div><span>Sales <strong>{money(row.sales_total_cents)}</strong></span><span>Deposits <strong>{money(row.deposited_cents)}</strong></span><span>Short <strong className={styles.bad}>{money(row.shortage_cents)}</strong></span><span>Over <strong className={styles.good}>{money(row.overage_cents)}</strong></span></div></article>)}</div></section> : null}
      {screen === "audit" ? <section data-testid="manager-audit"><h1>Audit log</h1><div className={styles.audit}>{(view.audit_log ?? []).map((row) => <article key={row.id}><strong>{row.action}</strong><span>{row.actor ?? "System"} · {stamp(row.created_at)}</span><small>{row.ref_type ?? "event"}{row.ref_id ? ` · ${row.ref_id}` : ""}</small></article>)}</div></section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.bottom} data-testid="manager-actions">{(["overview","stock","refills","closings","audit"] as Screen[]).map((item) => <button type="button" key={item} className={screen === item ? styles.active : ""} onClick={() => setScreen(item)}>{item === "overview" ? "Home" : item === "closings" ? "Closes" : item[0]!.toUpperCase() + item.slice(1)}</button>)}</footer>
  </main>;
}
