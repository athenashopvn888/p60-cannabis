"use client";

import { useEffect, useMemo, useState } from "react";
import { DurableCommandKeys } from "../../lib/pny-pos/durableCommand";
import styles from "./kitchen.module.css";

type Product = { sku: string; name: string; category: string; size: string; on_hand: number };
type HistoryRow = { kitchen_row_id: string; batch_id: string; sku: string; name: string; size: string; qty_sent: number; qty_received: number | null; status: string; created_at: string };
type KitchenView = { authenticated: boolean; store_code?: string; products?: Product[]; history?: HistoryRow[] };
type Screen = "refill" | "history" | "sent";

const previewProducts: Product[] = [
  { sku: "240", name: "Preview Product", category: "ADD ONS", size: "each", on_hand: 0 },
  { sku: "261-14g", name: "Daydream Diesel", category: "FLOWER", size: "14g", on_hand: 3 },
  { sku: "396-3g", name: "Preview Flower", category: "FLOWER", size: "3g", on_hand: 0 },
  { sku: "715", name: "Cigarettes", category: "CIGARETTES", size: "pack", on_hand: 12 },
];
const previewHistory: HistoryRow[] = [
  { kitchen_row_id: "preview-pending", batch_id: "PNYS-PREVIEW", sku: "240", name: "Preview Product", size: "each", qty_sent: 4, qty_received: null, status: "PENDING_CONFIRM", created_at: "2026-11-14T02:30:00.000Z" },
  { kitchen_row_id: "preview-confirmed", batch_id: "PNYS-EARLIER", sku: "261-14g", name: "Daydream Diesel", size: "14g", qty_sent: 2, qty_received: 2, status: "CONFIRMED", created_at: "2026-11-13T02:30:00.000Z" },
];

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "Request failed. Try again."));
  return body;
}

export default function KitchenApp({ preview }: { preview?: "login" | Screen }) {
  const isPreview = Boolean(preview);
  const [view, setView] = useState<KitchenView>(() => preview === "login" ? { authenticated: false } : isPreview ? { authenticated: true, store_code: "PNYS", products: previewProducts, history: previewHistory } : { authenticated: false });
  const [pin, setPin] = useState("");
  const [screen, setScreen] = useState<Screen>(preview && preview !== "login" ? preview : "refill");
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(preview === "sent" ? { "240": "4" } : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commands = useMemo(() => new DurableCommandKeys(), []);

  async function load() {
    const response = await fetch("/api/pos/kitchen/state", { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) { setView({ authenticated: false }); return; }
    setView(await readJson(response) as unknown as KitchenView);
  }

  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    void fetch("/api/pos/kitchen/state", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.status === 401 ? ({ authenticated: false } as KitchenView) : await readJson(response) as unknown as KitchenView)
      .then((next) => setView(next))
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load Kitchen."); });
    return () => controller.abort();
  }, [isPreview]);

  async function signIn() {
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ pin }) }));
      setPin(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  async function sendRefill() {
    const lines = Object.entries(qty).filter(([, value]) => /^\d+$/.test(value) && Number(value) > 0).map(([sku, value]) => ({ sku, qty: Number(value) }));
    if (!lines.length) { setError("Enter a quantity for at least one SKU."); return; }
    if (isPreview) { setScreen("sent"); return; }
    const body = { lines };
    const key = commands.key("kitchen-refill", body);
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/refills", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, credentials: "same-origin", body: JSON.stringify({ ...body, request_id: key }) }));
      commands.complete("kitchen-refill", key); setQty({}); await load(); setScreen("sent");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Refill was not sent."); }
    finally { setBusy(false); }
  }

  if (!view.authenticated) return <main className={styles.login} data-testid="kitchen-login">
    <section className={styles.loginCard}>
      <div className={styles.test}>TEST STORE</div><h1>PNYS Kitchen</h1><p>Enter the Kitchen PIN.</p>
      <div className={styles.pinDots} aria-label={`${pin.length} digits entered`}>{"●".repeat(pin.length) || "○ ○ ○ ○"}</div>
      <div className={styles.keypad}>{["1","2","3","4","5","6","7","8","9","Clear","0","⌫"].map((key) => <button key={key} type="button" onClick={() => setPin((value) => key === "Clear" ? "" : key === "⌫" ? value.slice(0, -1) : value.length < 6 ? value + key : value)}>{key}</button>)}</div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.signIn} type="button" disabled={busy || pin.length === 0} onClick={() => void signIn()}>Sign in</button>
    </section>
  </main>;

  const products = (view.products ?? []).filter((product) => `${product.sku} ${product.name} ${product.size}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className={styles.shell} data-testid="kitchen-shell" data-kitchen-screen={screen}>
    <header className={styles.top}><div><strong>{view.store_code ?? "PNYS"}</strong><span> · Kitchen</span></div><div><strong>{screen === "refill" ? "New refill" : screen === "history" ? "Refill history" : "Sent to store"}</strong></div><strong className={styles.test}>TEST STORE</strong></header>
    <div className={styles.middle}>
      {screen === "refill" ? <section data-testid="kitchen-refill">
        <label className={styles.searchLabel} htmlFor="kitchen-search">SKU, name or size</label><input id="kitchen-search" className={styles.search} placeholder="Search SKU, name or size" value={query} onChange={(event) => setQuery(event.target.value)} />
        <p className={styles.hint}>Zero on-hand SKUs remain searchable and can be added.</p>
        <div className={styles.products}>{products.map((product) => <article key={product.sku} className={styles.product} data-testid="kitchen-product" data-sku={product.sku}>
          <div><strong>{product.sku} · {product.size}</strong><span>{product.name}</span><small>On hand: {product.on_hand}</small></div>
          <input inputMode="numeric" aria-label={`Refill ${product.sku} ${product.size}`} placeholder="Qty" value={qty[product.sku] ?? ""} onChange={(event) => setQty({ ...qty, [product.sku]: event.target.value.replace(/[^\d]/g, "") })} />
        </article>)}</div>
      </section> : null}
      {screen === "history" ? <section data-testid="kitchen-history"><h1>Refill history</h1><div className={styles.history}>{(view.history ?? []).map((row) => <article key={row.kitchen_row_id}><div><strong>{row.sku} · {row.size}</strong><span>{row.name}</span></div><div><strong>{row.qty_sent} sent</strong><span className={row.status === "PENDING_CONFIRM" ? styles.pending : styles.confirmed}>{row.status === "PENDING_CONFIRM" ? "Waiting for staff" : row.status}</span></div></article>)}</div></section> : null}
      {screen === "sent" ? <section className={styles.sent} data-testid="kitchen-sent"><div className={styles.sentIcon}>✓</div><h1>Refill sent to PNYS</h1><p>It is pending. Store staff must open Refill and confirm the received quantities before stock changes.</p><button type="button" onClick={() => setScreen("history")}>View refill history</button></section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.bottom} data-testid="kitchen-actions">
      {screen === "refill" ? <><button type="button" className={styles.secondary} onClick={() => setScreen("history")}>History</button><button type="button" className={styles.scan} disabled>SCAN</button><button type="button" className={styles.primary} disabled={busy} onClick={() => void sendRefill()}>Send to store</button></> : null}
      {screen === "history" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>New refill</button> : null}
      {screen === "sent" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>Done</button> : null}
    </footer>
  </main>;
}
