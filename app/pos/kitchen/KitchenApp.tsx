"use client";

import { useEffect, useMemo, useState } from "react";
import { DurableCommandKeys } from "../../lib/pny-pos/durableCommand";
import styles from "./kitchen.module.css";

type Product = { sku: string; name: string; category: string; size: string; on_hand: number; sold_24h: number; pending_qty: number; suggested_refill_qty: number; enabled?: boolean; approval_required?: boolean };
type HistoryRow = { kitchen_row_id: string; batch_id: string; sku: string; name: string; size: string; qty_sent: number; qty_received: number | null; status: string; variance_reason?: string | null; sent_by?: string; received_by?: string | null; approval_required?: boolean; created_at: string; sent_at_toronto?: string; received_at_toronto?: string | null };
type KitchenView = { authenticated: boolean; store_code?: string; stores?: { code: string; name: string }[]; products?: Product[]; history?: HistoryRow[] };
type Screen = "refill" | "confirm" | "history" | "sent";
type Filter = "all" | "low" | "zero" | "pending";
type SortKey = "sku" | "on_hand" | "sold_24h" | "pending_qty";
type SortDirection = "asc" | "desc";
type RefillLine = { sku: string; name: string; size: string; qty: number; approval_required?: boolean };

const previewProducts: Product[] = [
  { sku: "240", name: "Preview Product", category: "ADD ONS", size: "each", on_hand: 0, sold_24h: 3, pending_qty: 0, suggested_refill_qty: 6, enabled: true },
  { sku: "261-14g", name: "Daydream Diesel", category: "FLOWER", size: "14g", on_hand: 3, sold_24h: 4, pending_qty: 2, suggested_refill_qty: 3 },
  { sku: "396-3g", name: "Preview Flower", category: "FLOWER", size: "3g", on_hand: 0, sold_24h: 0, pending_qty: 4, suggested_refill_qty: 0 },
  { sku: "715", name: "Cigarettes", category: "CIGARETTES", size: "pack", on_hand: 12, sold_24h: 4, pending_qty: 0, suggested_refill_qty: 0 },
  { sku: "656", name: "Knock Out MW", category: "EDIBLES", size: "each", on_hand: 0, sold_24h: 0, pending_qty: 0, suggested_refill_qty: 0, enabled: false, approval_required: true },
];
const previewHistory: HistoryRow[] = [
  { kitchen_row_id: "preview-pending", batch_id: "PNYS-PREVIEW", sku: "396-3g", name: "Preview Flower", size: "3g", qty_sent: 4, qty_received: null, status: "PENDING_CONFIRM", created_at: "2026-11-14T02:30:00.000Z" },
  { kitchen_row_id: "preview-confirmed", batch_id: "PNYS-EARLIER", sku: "261-14g", name: "Daydream Diesel", size: "14g", qty_sent: 2, qty_received: 2, status: "CONFIRMED", created_at: "2026-11-13T02:30:00.000Z" },
];
const noProducts: Product[] = [];

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "Request failed. Try again."));
  return body;
}

function screenTitle(screen: Screen) {
  if (screen === "refill") return "New refill";
  if (screen === "confirm") return "Confirm batch";
  if (screen === "history") return "Refill history";
  return "Sent to store";
}

export default function KitchenApp({ preview }: { preview?: "login" | Screen }) {
  const isPreview = Boolean(preview);
  const initialScreen = preview && preview !== "login" ? preview : "refill";
  const [view, setView] = useState<KitchenView>(() => preview === "login" ? { authenticated: false } : isPreview ? { authenticated: true, store_code: "PNYS", stores: [{ code: "PNYS", name: "PNYS Test Store" }], products: previewProducts, history: previewHistory } : { authenticated: false });
  const [pin, setPin] = useState("");
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("PNYS");
  const [skuRange, setSkuRange] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [qty, setQty] = useState<Record<string, string>>(() => preview === "sent" ? { "240": "6", "261-14g": "3" } : ({} as Record<string, string>));
  const [sentLines, setSentLines] = useState<RefillLine[]>(() => preview === "sent" ? [
    { sku: "240", name: "Preview Product", size: "each", qty: 6 },
    { sku: "261-14g", name: "Daydream Diesel", size: "14g", qty: 3 },
  ] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commands = useMemo(() => new DurableCommandKeys(), []);

  async function load() {
    const response = await fetch("/api/pos/kitchen/state", { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) { setView({ authenticated: false }); return; }
    const next = await readJson(response) as unknown as KitchenView;
    setView(next);
    setSelectedStore(next.store_code ?? "PNYS");
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

  const allProducts = view.products ?? noProducts;
  const refillLines = useMemo(() => allProducts.flatMap((product) => {
    const raw = qty[product.sku] ?? "";
    const amount = /^\d+$/.test(raw) ? Number(raw) : 0;
    return amount > 0 ? [{ sku: product.sku, name: product.name, size: product.size, qty: amount, approval_required: product.approval_required }] : [];
  }), [allProducts, qty]);
  const totalUnits = refillLines.reduce((sum, line) => sum + line.qty, 0);
  const skuRanges = useMemo(() => [...new Set(allProducts.map((product) => {
    const base = Number.parseInt(product.sku.match(/^\d+/)?.[0] ?? "", 10);
    return Number.isFinite(base) ? Math.floor(base / 100) * 100 : null;
  }).filter((value): value is number => value !== null))].sort((a, b) => a - b), [allProducts]);
  const products = allProducts.filter((product) => {
    const matchesQuery = `${product.sku} ${product.name} ${product.size}`.toLowerCase().includes(query.trim().toLowerCase());
    if (!matchesQuery) return false;
    if (skuRange !== "all") {
      const base = Number.parseInt(product.sku.match(/^\d+/)?.[0] ?? "", 10);
      if (!Number.isFinite(base) || Math.floor(base / 100) * 100 !== Number(skuRange)) return false;
    }
    if (filter === "low") return product.suggested_refill_qty > 0;
    if (filter === "zero") return product.on_hand === 0;
    if (filter === "pending") return product.pending_qty > 0;
    return true;
  }).sort((left, right) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sortKey === "sku") return direction * left.sku.localeCompare(right.sku, "en", { numeric: true });
    return direction * (left[sortKey] - right[sortKey] || left.sku.localeCompare(right.sku, "en", { numeric: true }));
  });

  function changeSort(next: SortKey) {
    if (sortKey === next) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(next); setSortDirection("asc"); }
  }

  function sortLabel(label: string, key: SortKey) {
    return `${label}${sortKey === key ? sortDirection === "asc" ? " ↑" : " ↓" : ""}`;
  }

  async function signIn() {
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ pin }) }));
      setPin(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!isPreview) await fetch("/api/pos/kitchen/logout", { method: "POST", credentials: "same-origin" });
    setPin(""); setQty({}); setView({ authenticated: false }); setScreen("refill");
  }

  function reviewBatch() {
    if (!refillLines.length) { setError("Enter a quantity for at least one SKU."); return; }
    setError(""); setScreen("confirm");
  }

  async function sendRefill() {
    if (!refillLines.length) { setError("Enter a quantity for at least one SKU."); setScreen("refill"); return; }
    if (isPreview) { setSentLines(refillLines); setScreen("sent"); return; }
    const body = { lines: refillLines.map(({ sku, qty: amount }) => ({ sku, qty: amount })) };
    const key = commands.key("kitchen-refill", body);
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/refills", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, credentials: "same-origin", body: JSON.stringify({ ...body, request_id: key }) }));
      commands.complete("kitchen-refill", key); setSentLines(refillLines); setQty({}); await load(); setScreen("sent");
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

  const batchLines = screen === "sent" ? sentLines : refillLines;
  const batchTotal = batchLines.reduce((sum, line) => sum + line.qty, 0);
  return <main className={styles.shell} data-testid="kitchen-shell" data-kitchen-screen={screen}>
    <header className={styles.top}>
      <div><strong>{view.store_code ?? "PNYS"}</strong><span> · Kitchen</span></div>
      <strong>{screenTitle(screen)}</strong>
      <div className={styles.topActions}><strong className={styles.test}>TEST STORE</strong><button type="button" onClick={() => void logout()}>Logout</button></div>
    </header>
    <div className={styles.middle}>
      {screen === "refill" ? <section data-testid="kitchen-refill">
        <label className={styles.storeLabel} htmlFor="kitchen-store">Store</label>
        <select id="kitchen-store" className={styles.storeSelect} value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>
          {(view.stores ?? [{ code: view.store_code ?? "PNYS", name: view.store_code ?? "PNYS" }]).map((store) => <option key={store.code} value={store.code}>{store.code} · {store.name}</option>)}
        </select>
        <label className={styles.searchLabel} htmlFor="kitchen-search">SKU, name or size</label><input id="kitchen-search" className={styles.search} placeholder="Search SKU, name or size" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className={styles.filters} aria-label="Refill filters">{(["all","low","zero","pending"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "low" ? "Low stock" : value === "zero" ? "Zero stock" : "Pending refill"}</button>)}</div>
        <div className={styles.skuRanges} aria-label="SKU sections"><button type="button" aria-pressed={skuRange === "all"} onClick={() => setSkuRange("all")}>All</button>{skuRanges.map((start) => <button key={start} type="button" aria-pressed={skuRange === String(start)} onClick={() => setSkuRange(String(start))}>{start}–{start + 99}</button>)}</div>
        <p className={styles.formula}><strong>Suggested refill</strong> = max(0, Sold 24h × 2 − On hand − Pending). Suggestions are hints and are never added until you tap Use suggested.</p>
        <div className={styles.legend}><button type="button" onClick={() => changeSort("sku")}>{sortLabel("SKU", "sku")}</button><button type="button" onClick={() => changeSort("on_hand")}>{sortLabel("On hand", "on_hand")}</button><button type="button" onClick={() => changeSort("sold_24h")}>{sortLabel("Sold 24h", "sold_24h")}</button><button type="button" onClick={() => changeSort("pending_qty")}>{sortLabel("Pending", "pending_qty")}</button><span>Refill</span></div>
        <div className={styles.products}>{products.map((product) => <article key={product.sku} className={styles.product} data-testid="kitchen-product" data-sku={product.sku}>
          <div className={styles.identity}><strong>{product.sku} · {product.size}</strong><span>{product.name}</span>{product.approval_required ? <em>Store approval required</em> : null}</div>
          <span className={styles.metric}><small>On hand</small><strong>{product.on_hand}</strong></span>
          <span className={styles.metric}><small>Sold 24h</small><strong>{product.sold_24h}</strong></span>
          <span className={styles.metric}><small>Pending</small><strong>{product.pending_qty}</strong></span>
          <label className={styles.qty}><small>Refill qty</small><input inputMode="numeric" aria-label={`Refill ${product.sku} ${product.size}`} value={qty[product.sku] ?? ""} onChange={(event) => setQty((current) => ({ ...current, [product.sku]: event.target.value.replace(/[^\d]/g, "") }))}/>{product.suggested_refill_qty > 0 ? <button type="button" onClick={() => setQty((current) => ({ ...current, [product.sku]: String(product.suggested_refill_qty) }))}>Use suggested {product.suggested_refill_qty}</button> : <small>Suggested 0</small>}</label>
        </article>)}</div>
        {!products.length ? <p className={styles.empty}>No SKUs match this filter.</p> : null}
      </section> : null}
      {screen === "confirm" ? <section className={styles.confirm} data-testid="kitchen-confirm"><h1>Confirm refill batch</h1><p>Review every quantity before sending. Stock will not change until store staff confirms receipt.</p><div className={styles.batch}>{batchLines.map((line) => <article key={line.sku}><div><strong>{line.sku} · {line.size}</strong><span>{line.name}</span>{line.approval_required ? <em>Store approval required</em> : null}</div><strong>{line.qty}</strong></article>)}</div><div className={styles.total}><span>{batchLines.length} SKUs</span><strong>{batchTotal} total units</strong></div></section> : null}
      {screen === "history" ? <section data-testid="kitchen-history"><h1>Refill history</h1><div className={styles.history}>{(view.history ?? []).map((row) => <article key={row.kitchen_row_id}><div><strong>{row.sku} · {row.size}</strong><span>{row.name}</span><small>Batch {row.batch_id} · sent by {row.sent_by ?? "Kitchen"}{row.sent_at_toronto ? ` · ${row.sent_at_toronto} Toronto` : ""}</small>{row.variance_reason ? <small>Reason: {row.variance_reason}</small> : null}</div><div><strong>{row.qty_sent} sent{row.qty_received == null ? "" : ` · ${row.qty_received} received`}</strong><span className={row.status === "PENDING_CONFIRM" ? styles.pending : styles.confirmed}>{row.status === "PENDING_CONFIRM" ? "Waiting for staff" : row.status}</span></div></article>)}</div></section> : null}
      {screen === "sent" ? <section className={styles.sent} data-testid="kitchen-sent"><div className={styles.sentIcon}>✓</div><h1>Refill sent to PNYS</h1><div className={styles.batch}>{batchLines.map((line) => <article key={line.sku}><span>{line.sku} · {line.size}</span><strong>{line.qty}</strong></article>)}</div><strong>{batchTotal} total units</strong><p>Status: PENDING_CONFIRM. Store staff must confirm the received quantities before stock changes.</p><button type="button" onClick={() => setScreen("history")}>View refill history</button></section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.bottom} data-testid="kitchen-actions">
      {screen === "refill" ? <><button type="button" className={styles.secondary} onClick={() => setScreen("history")}>History</button><button type="button" className={styles.scan} disabled>SCAN</button><button type="button" className={styles.primary} disabled={busy || totalUnits === 0} onClick={reviewBatch}>REFILL LIST · {totalUnits}</button></> : null}
      {screen === "confirm" ? <><button type="button" className={styles.secondary} disabled={busy} onClick={() => setScreen("refill")}>Back</button><button type="button" className={styles.primary} disabled={busy} onClick={() => void sendRefill()}>Send to store · {batchTotal}</button></> : null}
      {screen === "history" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>New refill</button> : null}
      {screen === "sent" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>Done</button> : null}
    </footer>
  </main>;
}
