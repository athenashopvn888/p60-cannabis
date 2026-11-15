"use client";

import { useEffect, useMemo, useState } from "react";
import { DurableCommandKeys } from "../../lib/pny-pos/durableCommand";
import styles from "./kitchen.module.css";

type Product = { sku: string; name: string; category: string; size: string; price_cents?: number; on_hand: number | null; sold_24h: number | null; pending_qty: number; suggested_refill_qty: number; availability?: string; enabled?: boolean; approval_required?: boolean };
type HistoryRow = { kitchen_row_id: string; batch_id: string; sku: string; name: string; size: string; qty_sent: number; qty_received: number | null; status: string; variance_reason?: string | null; sent_by?: string; received_by?: string | null; approval_required?: boolean; created_at: string; sent_at_toronto?: string; received_at_toronto?: string | null };
type KitchenView = { authenticated: boolean; store_code?: string; stores?: { code: string; name: string }[]; products?: Product[]; history?: HistoryRow[] };
type Screen = "refill" | "confirm" | "history" | "sent";
type Filter = "all" | "low" | "zero" | "pending";
type SortKey = "sku" | "on_hand" | "sold_24h" | "pending_qty";
type SortDirection = "asc" | "desc";
type Language = "vi" | "en";
type RefillLine = { sku: string; name: string; size: string; qty: number; approval_required?: boolean };
type ShadowReceiptLine = { sku: string; name: string; qty_sent: number; qty_received: number; variance: number; reason?: string | null };
type ShadowReceipt = { received_by: string; received_at_toronto: string; lines: ShadowReceiptLine[] };
type ShadowBatch = { id: string; store_code: "PNY01_TEST"; sender: string; sent_at: string; status: "PENDING" | "CONFIRMED" | "PARTIAL" | "REJECTED"; lines: RefillLine[]; receipt?: ShadowReceipt };
const SHADOW_KEY = "pnys-pny01-shadow-batches";
const LANGUAGE_KEY = "pnys-kitchen-language";

const copy = {
  vi: {
    enterPin: "Nhập mã PIN Kitchen.", signIn: "Đăng nhập", logout: "Đăng xuất", testStore: "CỬA HÀNG THỬ NGHIỆM",
    newRefill: "Tạo hàng bổ sung", confirmBatch: "Xác nhận lô hàng", refillHistory: "Lịch sử bổ sung", sentToStore: "Đã gửi đến cửa hàng",
    store: "Cửa hàng", search: "Tìm SKU, tên hoặc kích cỡ", all: "Tất cả", low: "Sắp hết", zero: "Hết hàng", pendingFilter: "Đang chờ bổ sung",
    sortBy: "Sắp xếp", onHand: "Tồn kho", sold: "Đã bán 24h", pending: "Đang chờ", refill: "Bổ sung", refillQty: "SL bổ sung",
    suggested: "Bổ sung đề xuất", formula: "= max(0, Đã bán 24h × 2 − Tồn kho − Đang chờ). Số đề xuất chỉ để tham khảo và không được thêm cho đến khi bấm Dùng đề xuất.",
    useSuggested: "Dùng đề xuất", suggestedZero: "Đề xuất 0", approval: "Cần cửa hàng duyệt", unavailable: "KHÔNG CÓ DỮ LIỆU", noMatch: "Không tìm thấy SKU phù hợp.",
    confirmTitle: "Xác nhận lô bổ sung", confirmHelp: "Kiểm tra từng số lượng trước khi gửi. Tồn kho chỉ thay đổi sau khi nhân viên cửa hàng xác nhận đã nhận.",
    skus: "SKU", totalUnits: "tổng sản phẩm", history: "Lịch sử", waiting: "Chờ nhân viên xác nhận", batch: "Lô", sentBy: "gửi bởi", reason: "Lý do",
    sent: "đã gửi", received: "đã nhận", sentHeading: "Đã gửi hàng bổ sung đến", statusHelp: "Trạng thái: PENDING_CONFIRM. Nhân viên cửa hàng phải xác nhận số lượng đã nhận trước khi tồn kho thay đổi.",
    newRefillButton: "Tạo bổ sung", back: "Quay lại", sendToStore: "Gửi đến cửa hàng", done: "Xong", refillList: "DANH SÁCH BỔ SUNG", totalStock: "TỔNG TỒN KHO", refillTotal: "BỔ SUNG", qtyShort: "SL",
  },
  en: {
    enterPin: "Enter the Kitchen PIN.", signIn: "Sign in", logout: "Logout", testStore: "TEST STORE",
    newRefill: "New refill", confirmBatch: "Confirm batch", refillHistory: "Refill history", sentToStore: "Sent to store",
    store: "Store", search: "Search SKU, name or size", all: "All", low: "Low stock", zero: "Zero stock", pendingFilter: "Pending refill",
    sortBy: "Sort by", onHand: "On hand", sold: "Sold 24h", pending: "Pending", refill: "Refill", refillQty: "Refill qty",
    suggested: "Suggested refill", formula: "= max(0, Sold 24h × 2 − On hand − Pending). Suggestions are hints and are never added until you tap Use suggested.",
    useSuggested: "Use suggested", suggestedZero: "Suggested 0", approval: "Store approval required", unavailable: "UNAVAILABLE", noMatch: "No SKUs match this filter.",
    confirmTitle: "Confirm refill batch", confirmHelp: "Review every quantity before sending. Stock will not change until store staff confirms receipt.",
    skus: "SKUs", totalUnits: "total units", history: "History", waiting: "Waiting for staff", batch: "Batch", sentBy: "sent by", reason: "Reason",
    sent: "sent", received: "received", sentHeading: "Refill sent to", statusHelp: "Status: PENDING_CONFIRM. Store staff must confirm the received quantities before stock changes.",
    newRefillButton: "New refill", back: "Back", sendToStore: "Send to store", done: "Done", refillList: "REFILL LIST", totalStock: "TOTAL STOCK", refillTotal: "REFILL", qtyShort: "QTY",
  },
} as const;

const previewProducts: Product[] = [
  { sku: "240", name: "Preview Product", category: "ADD ONS", size: "each", price_cents: 500, on_hand: 0, sold_24h: 3, pending_qty: 0, suggested_refill_qty: 6, enabled: true },
  { sku: "261-14g", name: "Daydream Diesel", category: "FLOWER", size: "14g", price_cents: 4000, on_hand: 3, sold_24h: 4, pending_qty: 2, suggested_refill_qty: 3 },
  { sku: "396-3g", name: "Preview Flower", category: "FLOWER", size: "3g", price_cents: 3000, on_hand: 0, sold_24h: 0, pending_qty: 4, suggested_refill_qty: 0 },
  { sku: "715", name: "Cigarettes", category: "CIGARETTES", size: "pack", price_cents: 250, on_hand: 12, sold_24h: 4, pending_qty: 0, suggested_refill_qty: 0 },
  { sku: "656", name: "Knock Out MW", category: "EDIBLES", size: "each", price_cents: 3500, on_hand: 0, sold_24h: 0, pending_qty: 0, suggested_refill_qty: 0, enabled: false, approval_required: true },
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

function screenTitle(screen: Screen, language: Language) {
  const text = copy[language];
  if (screen === "refill") return text.newRefill;
  if (screen === "confirm") return text.confirmBatch;
  if (screen === "history") return text.refillHistory;
  return text.sentToStore;
}

function readShadowBatches() {
  try { return JSON.parse(localStorage.getItem(SHADOW_KEY) || "[]") as ShadowBatch[]; }
  catch { return [] as ShadowBatch[]; }
}

function withShadowReceipts(next: KitchenView): KitchenView {
  const batches = readShadowBatches();
  const receivedBySku = new Map<string, number>();
  for (const batch of batches) for (const line of batch.receipt?.lines ?? []) {
    receivedBySku.set(line.sku, (receivedBySku.get(line.sku) ?? 0) + line.qty_received);
  }
  const products = (next.products ?? []).map((product) => ({
    ...product,
    on_hand: product.on_hand == null ? null : product.on_hand + (receivedBySku.get(product.sku) ?? 0),
  }));
  const history = batches.flatMap((batch) => batch.lines.map((line) => {
    const received = batch.receipt?.lines.find((row) => row.sku === line.sku);
    return {
      kitchen_row_id: `${batch.id}:${line.sku}`,
      batch_id: batch.id,
      sku: line.sku,
      name: line.name,
      size: line.size,
      qty_sent: line.qty,
      qty_received: received?.qty_received ?? null,
      status: batch.status === "PENDING" ? "PENDING_CONFIRM" : batch.status,
      variance_reason: received?.reason ?? null,
      sent_by: batch.sender,
      received_by: batch.receipt?.received_by ?? null,
      created_at: batch.sent_at,
      sent_at_toronto: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.sent_at)),
      received_at_toronto: batch.receipt?.received_at_toronto ?? null,
      approval_required: line.approval_required,
    } satisfies HistoryRow;
  }));
  return { ...next, products, history };
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
  const [language, setLanguage] = useState<Language>("vi");
  const [qty, setQty] = useState<Record<string, string>>(() => preview === "sent" ? { "240": "6", "261-14g": "3" } : ({} as Record<string, string>));
  const [sentLines, setSentLines] = useState<RefillLine[]>(() => preview === "sent" ? [
    { sku: "240", name: "Preview Product", size: "each", qty: 6 },
    { sku: "261-14g", name: "Daydream Diesel", size: "14g", qty: 3 },
  ] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commands = useMemo(() => new DurableCommandKeys(), []);
  const text = copy[language];

  useEffect(() => {
    if (isPreview) return;
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "vi" || saved === "en") setLanguage(saved);
  }, [isPreview]);

  function chooseLanguage(next: Language) {
    setLanguage(next);
    if (!isPreview) localStorage.setItem(LANGUAGE_KEY, next);
  }

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

  useEffect(() => {
    if (isPreview || !view.authenticated || selectedStore === "PNY01_TEST") return;
    if (new URLSearchParams(window.location.search).get("store") !== "PNY01_TEST") return;
    void chooseStore("PNY01_TEST");
    // The query string is a one-time test-store handoff after Kitchen authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, view.authenticated, selectedStore]);

  useEffect(() => {
    if (isPreview || !view.authenticated || selectedStore !== "PNY01_TEST") return;
    const refresh = () => { void loadShadowStore(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, view.authenticated, selectedStore]);

  const allProducts = view.products ?? noProducts;
  const refillLines = useMemo(() => allProducts.flatMap((product) => {
    const raw = qty[product.sku] ?? "";
    const amount = /^\d+$/.test(raw) ? Number(raw) : 0;
    return amount > 0 ? [{ sku: product.sku, name: product.name, size: product.size, qty: amount, approval_required: product.approval_required }] : [];
  }), [allProducts, qty]);
  const totalUnits = refillLines.reduce((sum, line) => sum + line.qty, 0);
  const totalStockQty = allProducts.reduce((sum, product) => sum + Math.max(0, product.on_hand ?? 0), 0);
  const totalStockValueCents = allProducts.reduce((sum, product) => sum + Math.max(0, product.on_hand ?? 0) * Math.max(0, product.price_cents ?? 0), 0);
  const priceBySku = useMemo(() => new Map(allProducts.map((product) => [product.sku, product.price_cents ?? 0])), [allProducts]);
  const refillValueCents = refillLines.reduce((sum, line) => sum + line.qty * (priceBySku.get(line.sku) ?? 0), 0);
  const money = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
  const skuRanges = useMemo(() => {
    const highest = Math.max(1000, ...allProducts.map((product) => Number.parseInt(product.sku.match(/^\d+/)?.[0] ?? "", 10)).filter(Number.isFinite));
    const last = Math.max(100, Math.floor(highest / 100) * 100);
    return Array.from({ length: (last - 100) / 100 + 1 }, (_, index) => 100 + index * 100);
  }, [allProducts]);
  const products = allProducts.filter((product) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = `${product.sku} ${product.name} ${product.size}`.toLowerCase().includes(search);
    if (!matchesQuery) return false;
    if (!search && skuRange !== "all") {
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
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];
    if (leftValue == null && rightValue == null) return left.sku.localeCompare(right.sku, "en", { numeric: true });
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return direction * (leftValue - rightValue || left.sku.localeCompare(right.sku, "en", { numeric: true }));
  });

  function changeSort(next: SortKey) {
    if (sortKey === next) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(next); setSortDirection("asc"); }
  }

  function sortLabel(label: string, key: SortKey) {
    return `${label}${sortKey === key ? sortDirection === "asc" ? " ↑" : " ↓" : ""}`;
  }

  async function loadShadowStore() {
    const next = await readJson(await fetch("/api/pos/kitchen/pny01-shadow", { cache: "no-store", credentials: "same-origin" })) as unknown as KitchenView;
    setView((current) => ({ ...current, ...withShadowReceipts(next), stores: current.stores }));
    setSelectedStore("PNY01_TEST");
  }

  async function chooseStore(code: string) {
    setBusy(true); setError(""); setQty({}); setSkuRange("all");
    try {
      if (code === "PNY01_TEST") {
        await loadShadowStore();
      } else {
        await load();
        setSelectedStore(code);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load that store."); }
    finally { setBusy(false); }
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
    if (selectedStore === "PNY01_TEST") {
      const batch: ShadowBatch = { id: `PNY01-TEST-${Date.now()}`, store_code: "PNY01_TEST", sender: "Kitchen", sent_at: new Date().toISOString(), status: "PENDING", lines: refillLines };
      const existing = readShadowBatches();
      localStorage.setItem(SHADOW_KEY, JSON.stringify([...existing, batch]));
      setSentLines(refillLines); setQty({}); setScreen("sent"); return;
    }
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
      <div className={styles.language}><button type="button" aria-pressed={language === "vi"} onClick={() => chooseLanguage("vi")}>VN</button><button type="button" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>ENG</button></div>
      <div className={styles.test}>{text.testStore}</div><h1>PNYS Kitchen</h1><p>{text.enterPin}</p>
      <div className={styles.pinDots} aria-label={`${pin.length} digits entered`}>{"●".repeat(pin.length) || "○ ○ ○ ○"}</div>
      <div className={styles.keypad}>{["1","2","3","4","5","6","7","8","9","Clear","0","⌫"].map((key) => <button key={key} type="button" onClick={() => setPin((value) => key === "Clear" ? "" : key === "⌫" ? value.slice(0, -1) : value.length < 6 ? value + key : value)}>{key}</button>)}</div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.signIn} type="button" disabled={busy || pin.length === 0} onClick={() => void signIn()}>{text.signIn}</button>
    </section>
  </main>;

  const batchLines = screen === "sent" ? sentLines : refillLines;
  const batchTotal = batchLines.reduce((sum, line) => sum + line.qty, 0);
  return <main className={styles.shell} data-testid="kitchen-shell" data-kitchen-screen={screen}>
    <header className={styles.top}>
      <div><strong>{view.store_code ?? "PNYS"}</strong><span> · Kitchen</span></div>
      <div className={styles.topStats} aria-label={screenTitle(screen, language)}><span><small>{text.totalStock}</small><strong>{money(totalStockValueCents)}</strong><b>{text.qtyShort} {totalStockQty}</b></span><span><small>{text.refillTotal}</small><strong>{money(refillValueCents)}</strong><b>{text.qtyShort} {totalUnits}</b></span></div>
      <div className={styles.topActions}><div className={styles.language}><button type="button" aria-pressed={language === "vi"} onClick={() => chooseLanguage("vi")}>VN</button><button type="button" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>ENG</button></div><strong className={styles.test}>{text.testStore}</strong><button type="button" onClick={() => void logout()}>{text.logout}</button></div>
    </header>
    <div className={styles.middle}>
      {screen === "refill" ? <section data-testid="kitchen-refill">
        <label className={styles.storeLabel} htmlFor="kitchen-store">{text.store}</label>
        <select id="kitchen-store" className={styles.storeSelect} value={selectedStore} disabled={busy} onChange={(event) => void chooseStore(event.target.value)}>
          {[...(view.stores ?? [{ code: "PNYS", name: "PNYS" }]).filter((store) => store.code !== "PNY01_TEST"), { code: "PNY01_TEST", name: "PNY01 Stock Snapshot · Test Receiver" }].map((store) => <option key={store.code} value={store.code}>{store.code} · {store.name}</option>)}
        </select>
        <label className={styles.searchLabel} htmlFor="kitchen-search">{text.search}</label><input id="kitchen-search" className={styles.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className={styles.filters} aria-label="Refill filters">{(["all","low","zero","pending"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? text.all : value === "low" ? text.low : value === "zero" ? text.zero : text.pendingFilter}</button>)}</div>
        <div className={styles.skuRanges} aria-label="SKU sections"><button type="button" aria-pressed={skuRange === "all"} onClick={() => setSkuRange("all")}>{text.all}</button>{skuRanges.map((start) => <button key={start} type="button" aria-pressed={skuRange === String(start)} onClick={() => setSkuRange(String(start))}>{start}–{start + 99}</button>)}</div>
        <div className={styles.mobileSort} aria-label="Mobile sort"><strong>{text.sortBy}</strong><button type="button" onClick={() => changeSort("sku")}>{sortLabel("SKU", "sku")}</button><button type="button" onClick={() => changeSort("on_hand")}>{sortLabel(text.onHand, "on_hand")}</button><button type="button" onClick={() => changeSort("sold_24h")}>{sortLabel(text.sold, "sold_24h")}</button><button type="button" onClick={() => changeSort("pending_qty")}>{sortLabel(text.pending, "pending_qty")}</button></div>
        <p className={styles.formula}><strong>{text.suggested}</strong> {text.formula}</p>
        <div className={styles.legend}><button type="button" onClick={() => changeSort("sku")}>{sortLabel("SKU", "sku")}</button><button type="button" onClick={() => changeSort("on_hand")}>{sortLabel(text.onHand, "on_hand")}</button><button type="button" onClick={() => changeSort("sold_24h")}>{sortLabel(text.sold, "sold_24h")}</button><button type="button" onClick={() => changeSort("pending_qty")}>{sortLabel(text.pending, "pending_qty")}</button><span>{text.refill}</span></div>
        <div className={styles.products}>{products.map((product) => <article key={product.sku} className={styles.product} data-testid="kitchen-product" data-sku={product.sku}>
          <div className={styles.identity}><strong>{product.sku} · {product.size}</strong><span>{product.name}</span>{product.approval_required ? <em>{text.approval}</em> : null}</div>
          <span className={styles.metric}><small>{text.onHand}</small><strong>{product.on_hand ?? "—"}</strong>{product.on_hand == null ? <small>{product.availability ?? text.unavailable}</small> : null}</span>
          <span className={styles.metric}><small>{text.sold}</small><strong>{product.sold_24h ?? "—"}</strong></span>
          <span className={styles.metric}><small>{text.pending}</small><strong>{product.pending_qty}</strong></span>
          <label className={styles.qty}><small>{text.refillQty}</small><input inputMode="numeric" aria-label={`Refill ${product.sku} ${product.size}`} value={qty[product.sku] ?? ""} onChange={(event) => setQty((current) => ({ ...current, [product.sku]: event.target.value.replace(/[^\d]/g, "") }))}/>{product.suggested_refill_qty > 0 ? <button type="button" onClick={() => setQty((current) => ({ ...current, [product.sku]: String(product.suggested_refill_qty) }))}>{text.useSuggested} {product.suggested_refill_qty}</button> : <small>{text.suggestedZero}</small>}</label>
        </article>)}</div>
        {!products.length ? <p className={styles.empty}>{text.noMatch}</p> : null}
      </section> : null}
      {screen === "confirm" ? <section className={styles.confirm} data-testid="kitchen-confirm"><h1>{text.confirmTitle}</h1><p>{text.confirmHelp}</p><div className={styles.batch}>{batchLines.map((line) => <article key={line.sku}><div><strong>{line.sku} · {line.size}</strong><span>{line.name}</span>{line.approval_required ? <em>{text.approval}</em> : null}</div><strong>{line.qty}</strong></article>)}</div><div className={styles.total}><span>{batchLines.length} {text.skus}</span><strong>{batchTotal} {text.totalUnits}</strong></div></section> : null}
      {screen === "history" ? <section data-testid="kitchen-history"><h1>{text.refillHistory}</h1><div className={styles.history}>{(view.history ?? []).map((row) => <article key={row.kitchen_row_id}><div><strong>{row.sku} · {row.size}</strong><span>{row.name}</span><small>{text.batch} {row.batch_id} · {text.sentBy} {row.sent_by ?? "Kitchen"}{row.sent_at_toronto ? ` · ${row.sent_at_toronto} Toronto` : ""}</small>{row.variance_reason ? <small>{text.reason}: {row.variance_reason}</small> : null}</div><div><strong>{row.qty_sent} {text.sent}{row.qty_received == null ? "" : ` · ${row.qty_received} ${text.received}`}</strong><span className={row.status === "PENDING_CONFIRM" ? styles.pending : styles.confirmed}>{row.status === "PENDING_CONFIRM" ? text.waiting : row.status}</span></div></article>)}</div></section> : null}
      {screen === "sent" ? <section className={styles.sent} data-testid="kitchen-sent"><div className={styles.sentIcon}>✓</div><h1>{text.sentHeading} {selectedStore === "PNY01_TEST" ? "PNY01 TEST RECEIVER" : "PNYS"}</h1><div className={styles.batch}>{batchLines.map((line) => <article key={line.sku}><span>{line.sku} · {line.size}</span><strong>{line.qty}</strong></article>)}</div><strong>{batchTotal} {text.totalUnits}</strong><p>{text.statusHelp}</p>{selectedStore === "PNY01_TEST" ? <a className={styles.receiverLink} href="/pos/pny01-refill-preview">PNY01 TEST RECEIVER</a> : <button type="button" onClick={() => setScreen("history")}>{text.refillHistory}</button>}</section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.bottom} data-testid="kitchen-actions">
      {screen === "refill" ? <><button type="button" className={styles.secondary} onClick={() => setScreen("history")}>{text.history}</button><button type="button" className={styles.scan} disabled>SCAN</button><button type="button" className={styles.primary} disabled={busy || totalUnits === 0} onClick={reviewBatch}>{text.refillList} · {totalUnits}</button></> : null}
      {screen === "confirm" ? <><button type="button" className={styles.secondary} disabled={busy} onClick={() => setScreen("refill")}>{text.back}</button><button type="button" className={styles.primary} disabled={busy} onClick={() => void sendRefill()}>{text.sendToStore} · {batchTotal}</button></> : null}
      {screen === "history" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>{text.newRefillButton}</button> : null}
      {screen === "sent" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>{text.done}</button> : null}
    </footer>
  </main>;
}
