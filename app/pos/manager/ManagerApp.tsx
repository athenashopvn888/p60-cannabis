"use client";

import { useEffect, useMemo, useState } from "react";
import { DurableCommandKeys } from "../../lib/pny-pos/durableCommand";
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
  weed_mode?: { current: "WEED" | "NO_WEED"; shift_id: string | null; can_change: boolean; thc_sku_count: number; undo_backup_id: string | null };
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
  weed_mode: { current: "WEED", shift_id: "PNYS-1114-A", can_change: true, thc_sku_count: 219, undo_backup_id: null },
};

const labels: Record<Screen, string> = { overview: "Overview", stock: "Stock on hand", refills: "Refill history", closings: "Closing reports", audit: "Audit log" };
const money = (cents = 0) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
const stamp = (value?: string | null) => value ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "Request failed. Try again."));
  return body;
}

export default function ManagerApp({ preview, previewMode = "weed" }: { preview?: "login" | Screen; previewMode?: "weed" | "no-weed" }) {
  const isPreview = Boolean(preview);
  const [view, setView] = useState<ManagerView>(() => preview === "login" ? { authenticated: false } : isPreview ? { ...previewView, weed_mode: { ...previewView.weed_mode!, current: previewMode === "no-weed" ? "NO_WEED" : "WEED" } } : { authenticated: false });
  const [screen, setScreen] = useState<Screen>(preview && preview !== "login" ? preview : "overview");
  const [pin, setPin] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [weedTarget, setWeedTarget] = useState<boolean | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const commands = useMemo(() => new DurableCommandKeys(), []);

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

  async function saveWeedMode() {
    if (weedTarget == null) return;
    if (isPreview) {
      setView((current) => ({ ...current, weed_mode: { ...current.weed_mode!, current: weedTarget ? "WEED" : "NO_WEED", undo_backup_id: "preview-backup" } }));
      setWeedTarget(null);
      return;
    }
    const body = { weed_in_store: weedTarget, confirm: true };
    const key = commands.key("manager-weed-mode", body);
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/manager/weed", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, credentials: "same-origin", body: JSON.stringify({ ...body, request_id: key }) }));
      commands.complete("manager-weed-mode", key); setWeedTarget(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mode was not changed."); }
    finally { setBusy(false); }
  }

  async function undoWeedMode() {
    const backup = view.weed_mode?.undo_backup_id;
    if (!backup) return;
    if (isPreview) {
      setView((current) => ({ ...current, weed_mode: { ...current.weed_mode!, current: current.weed_mode?.current === "WEED" ? "NO_WEED" : "WEED", undo_backup_id: null } }));
      setUndoOpen(false);
      return;
    }
    const body = { action: "undo", backup_id: backup, confirm: true };
    const key = commands.key("manager-weed-undo", body);
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/manager/weed", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, credentials: "same-origin", body: JSON.stringify({ ...body, request_id: key }) }));
      commands.complete("manager-weed-undo", key); setUndoOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mode was not restored."); }
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
      <aside className={styles.readOnly}>CONTROLLED WRITES · Price, stock and expense changes stay locked. WEED mode uses exact confirmation plus an audited backup and undo.</aside>
      {screen === "overview" ? <section data-testid="manager-overview">
        <h1>Live shift</h1>{view.live_shift ? <article className={styles.shift}><div><span>Status</span><strong>{view.live_shift.status}</strong></div><div><span>Staff</span><strong>{view.live_shift.staff_name}</strong></div><div><span>Started</span><strong>{stamp(view.live_shift.started_at)}</strong></div><div><span>Shift</span><strong>{view.live_shift.shift_id}</strong></div></article> : <p className={styles.empty}>No shift active.</p>}
        <article className={`${styles.modeCard} ${view.weed_mode?.current === "NO_WEED" ? styles.modeOff : styles.modeOn}`} data-testid="manager-weed-mode"><div><span>Store / shift mode</span><strong>{view.weed_mode?.current === "NO_WEED" ? "NO WEED" : "WEED"}</strong><small>{view.weed_mode?.current === "NO_WEED" ? `${view.weed_mode.thc_sku_count} THC SKUs hidden from sell and customer menu. Closing still counts them.` : "Default mode. All eligible SKUs remain available."}</small></div><div className={styles.modeActions}><button type="button" disabled={!view.weed_mode?.can_change || busy} onClick={() => setWeedTarget(view.weed_mode?.current === "NO_WEED")}>Set {view.weed_mode?.current === "NO_WEED" ? "WEED" : "NO WEED"}</button>{view.weed_mode?.undo_backup_id ? <button type="button" className={styles.undo} onClick={() => setUndoOpen(true)}>Undo last change</button> : null}</div></article>
        <h1>Today&apos;s sales</h1><div className={styles.cards}><article><span>Total</span><strong>{money(view.today?.sales_total_cents)}</strong><small>{view.today?.sale_count ?? 0} sales</small></article><article><span>Cash</span><strong>{money(view.today?.cash_cents)}</strong></article><article><span>Debit</span><strong>{money(view.today?.debit_cents)}</strong></article></div>
      </section> : null}
      {screen === "stock" ? <section data-testid="manager-stock"><label htmlFor="manager-stock-search">Search SKU, name or size</label><input id="manager-stock-search" className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock"/><div className={styles.list}>{stock.map((row) => <article key={row.sku}><div><strong>{row.sku} · {row.size}</strong><span>{row.name}</span><small>{money(row.price_cents)}</small></div><strong className={row.on_hand === 0 ? styles.zero : ""}>{row.on_hand}</strong></article>)}</div></section> : null}
      {screen === "refills" ? <section data-testid="manager-refills"><h1>Kitchen → staff</h1><div className={styles.list}>{(view.refills ?? []).map((row) => <article key={row.kitchen_row_id}><div><strong>{row.sku} · {row.name}</strong><span>Kitchen sent {row.qty_sent} · {stamp(row.kitchen_sent_at)}</span><small>{row.staff_confirmed_at ? `Staff confirmed ${row.qty_received ?? 0} · ${stamp(row.staff_confirmed_at)}` : "Waiting for staff confirmation"}</small></div><span className={row.staff_confirmed_at ? styles.good : styles.wait}>{row.staff_confirmed_at ? "CONFIRMED" : "PENDING"}</span></article>)}</div></section> : null}
      {screen === "closings" ? <section data-testid="manager-closings"><h1>Closing reports</h1><div className={styles.reportList}>{(view.closings ?? []).map((row) => <article key={row.shift_id}><header><strong>{row.shift_id}</strong><span>{row.staff_name} · {stamp(row.ended_at)}</span></header><div><span>Sales <strong>{money(row.sales_total_cents)}</strong></span><span>Deposits <strong>{money(row.deposited_cents)}</strong></span><span>Short <strong className={styles.bad}>{money(row.shortage_cents)}</strong></span><span>Over <strong className={styles.good}>{money(row.overage_cents)}</strong></span></div></article>)}</div></section> : null}
      {screen === "audit" ? <section data-testid="manager-audit"><h1>Audit log</h1><div className={styles.audit}>{(view.audit_log ?? []).map((row) => <article key={row.id}><strong>{row.action}</strong><span>{row.actor ?? "System"} · {stamp(row.created_at)}</span><small>{row.ref_type ?? "event"}{row.ref_id ? ` · ${row.ref_id}` : ""}</small></article>)}</div></section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
    {weedTarget != null ? <div className={styles.dialog} role="dialog" aria-modal="true" data-testid="manager-weed-confirm"><section><h2>Confirm exact change</h2><p><strong>PNYS · {view.weed_mode?.shift_id}</strong></p><div className={styles.change}><span>{view.weed_mode?.current}</span><b>→</b><span>{weedTarget ? "WEED" : "NO WEED"}</span></div><p>{weedTarget ? "THC SKUs will show again using their saved stock." : "THC SKUs will be hidden on sell and customer menu. Closing count will still include them."}</p><p>An undo backup and audit entry will be written first. Stock quantities will not change.</p>{error ? <p className={styles.error}>{error}</p> : null}<div><button type="button" onClick={() => setWeedTarget(null)}>Cancel</button><button type="button" disabled={busy} onClick={() => void saveWeedMode()}>Confirm and save</button></div></section></div> : null}
    {undoOpen ? <div className={styles.dialog} role="dialog" aria-modal="true" data-testid="manager-weed-undo"><section><h2>Undo last mode change?</h2><p>The audited backup will restore the prior WEED mode for shift <strong>{view.weed_mode?.shift_id}</strong>.</p><div><button type="button" onClick={() => setUndoOpen(false)}>Cancel</button><button type="button" disabled={busy} onClick={() => void undoWeedMode()}>Confirm undo</button></div></section></div> : null}
    <footer className={styles.bottom} data-testid="manager-actions">{(["overview","stock","refills","closings","audit"] as Screen[]).map((item) => <button type="button" key={item} className={screen === item ? styles.active : ""} onClick={() => setScreen(item)}>{item === "overview" ? "Home" : item === "closings" ? "Closes" : item[0]!.toUpperCase() + item.slice(1)}</button>)}</footer>
  </main>;
}
