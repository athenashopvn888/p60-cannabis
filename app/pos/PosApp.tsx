"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { bagLabel, groupByStrain, isFlowerCategory } from "../lib/pny-pos/flowerSku";
import { defaultCategory, formatMoney, sortCategories } from "../lib/pny-pos/money";
import CloseShift, { type CloseLine } from "./CloseShift";
import DepositSlip from "./DepositSlip";
import CustomerQr from "./CustomerQr";
import OpeningCount, { type OpeningLine } from "./OpeningCount";
import SkuOffList, { type OffLine } from "./SkuOffList";
import CountCard from "./CountCard";
import RefillList, { type PendingRefill } from "./RefillList";
import VerifyBanner, { useVerifyOpen } from "./VerifyBanner";

type VerifyLine = { sku: string; text: string; name: string; price_cents: number; counted_qty: number | null; locked?: boolean };
import { usePosPoll } from "./usePosPoll";
import { ProductPhoto } from "./ProductPhoto";
import styles from "./till.module.css";

type Product = { sku: string; name: string; category: string; price_cents: number; price_source?: string; image_url?: string | null; flower_type?: string; thc?: string };

function compareSku(a: string, b: string) {
  return a.localeCompare(b, "en", { numeric: true });
}
type Ticket = { id: string; code: string; status: string; expires_at: string; lines: { sku: string; name: string; qty: number }[] };
type CountLine = { sku: string; name: string };
type View = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  demo_pin?: string | null;
  phase?: string;
  master?: boolean;
  can_sell?: boolean;
  block?: string | null;
  shift?: { staff_name: string; pos_id: string; status: string; ticket_letter: string };
  totals?: { sales_cents: number; cash_sales_cents?: number; debit_sales_cents?: number; cash_on_hand_cents: number; deposited_cents: number };
  close_lines?: CloseLine[];
  opening_lines?: OpeningLine[];
  final_deposit_cents?: number | null;
  categories?: string[];
  products?: Product[];
  count_lines?: CountLine[];
  incoming?: PendingRefill[];
  tickets?: Ticket[];
  pending_count?: number;
  sheet_sync_delayed?: boolean;
  end_shift_message?: string;
  verify?: {
    show_banner?: boolean;
    deadline_at?: string | null;
    waiting?: boolean;
    reveal?: boolean;
    lines?: VerifyLine[];
    opening_off?: number;
    opening_lines?: OffLine[];
  };
  stock_check?: {
    opening: { offCount: number; ready?: boolean; lines: OffLine[] };
    closing: { offCount: number; ready?: boolean; lines: OffLine[] };
    refills?: { count: number; lines: { sku: string; text: string; sent: number; received: number; diff: number }[] };
  };
  error?: string;
  code?: string;
};

async function post(url: string, body: unknown, key?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), credentials: "same-origin" });
  const data = await response.json();
  if (!response.ok) {
    const failure = new Error(data.error || "Request failed") as Error & { code?: string };
    failure.code = typeof data.code === "string" ? data.code : undefined;
    throw failure;
  }
  return data;
}

function failureText(error: unknown) {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    return code ? `${error.message} (${code})` : error.message;
  }
  return "Could not sign in.";
}

export default function PosApp() {
  const [view, setView] = useState<View | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<"sell" | "tickets">("sell");
  const [sheet, setSheet] = useState<"cash" | "close" | "done" | "deposit-pin" | "deposit-amount" | "summary-pin" | null>(null);
  const [depositPin, setDepositPin] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [summaryPin, setSummaryPin] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [summaryDeposits, setSummaryDeposits] = useState<{ deposit_code?: string | null; amount_cents: number; at: string }[]>([]);
  const [depositCode, setDepositCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refillOpen, setRefillOpen] = useState(false);
  const [refNo, setRefNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTicket, setActiveTicket] = useState<{ id: string; code: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/pos/state", { cache: "no-store", credentials: "same-origin" });
    const data = (await response.json()) as View;
    setView(data);
    if (!data.authenticated) setActiveTicket(null);
    else setActiveTicket((current) => (current && data.tickets?.some((ticket) => ticket.id === current.id) ? current : null));
    if (!data.authenticated) {
      setCart({});
      if (data.error) setError(data.code ? `${data.error} (${data.code})` : data.error);
    }
  }, []);

  usePosPoll(load);
  const verifyOpen = useVerifyOpen(view?.verify?.show_banner ? view.verify.deadline_at ?? null : null, load);
  const showVerify = Boolean(view?.phase === "sell" && (verifyOpen || view.verify?.waiting));

  const products = view?.products ?? [];
  const categories = useMemo(() => sortCategories(view?.categories ?? []), [view?.categories]);
  const activeCategory = categories.includes(category) ? category : defaultCategory(categories);
  const visible = useMemo(() => {
    const rows = view?.products ?? [];
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((product) => {
      if (product.category !== activeCategory) return false;
      if (!q) return true;
      return product.sku.includes(q) || product.name.toLowerCase().includes(q);
    });
    if (!isFlowerCategory(activeCategory)) return filtered;
    return [...filtered].sort((a, b) => compareSku(a.sku, b.sku));
  }, [view?.products, query, activeCategory]);
  const blocks = useMemo(() => groupByStrain(visible), [visible]);

  const total = products.reduce((sum, product) => sum + (cart[product.sku] ?? 0) * product.price_cents, 0);
  const cartEmpty = Object.keys(cart).length === 0;

  function clearCart() {
    setCart({});
  }

  function setQty(product: Product, next: number) {
    const qty = Math.max(0, Math.min(99, next));
    setCart((current) => {
      const copy = { ...current };
      if (qty === 0) delete copy[product.sku];
      else copy[product.sku] = qty;
      return copy;
    });
  }

  async function signIn() {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/login", { pin });
      setPin("");
      await load();
    } catch (err) {
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  async function cashout(method: "CASH" | "DEBIT") {
    setError("");
    setBusy(true);
    try {
      const lines = Object.entries(cart).map(([sku, qty]) => ({ sku, qty }));
      const result = await post("/api/pos/cashout", { lines, ticket_id: activeTicket?.id ?? null, payment_method: method }, crypto.randomUUID());
      setRefNo(String(result.ref_no));
      setCart({});
      setActiveTicket(null);
      setSheet("done");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cashout failed");
    } finally {
      setBusy(false);
    }
  }

  function openEnd() {
    setError("");
    setSheet("close");
  }

  function openDeposit() {
    setError("");
    setDepositPin("");
    setDepositAmount("");
    setSheet("deposit-pin");
  }

  async function openSummary() {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/deposits/confirm-pin", { pin: summaryPin });
      setSummaryPin("");
      const data = await fetch("/api/pos/summary", { cache: "no-store", credentials: "same-origin" }).then((response) => response.json());
      if (!data.ok) throw new Error(data.error || "Summary was not loaded");
      setSummaryDeposits(Array.isArray(data.deposits) ? data.deposits : []);
      setSummaryText(String(data.text ?? ""));
      setSheet(null);
    } catch (err) {
      setSummaryPin("");
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function confirmDepositPin() {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/deposits/confirm-pin", { pin: depositPin });
      setDepositPin("");
      setSheet("deposit-amount");
    } catch (err) {
      setDepositPin("");
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveDeposit() {
    setError("");
    const cents = Math.round(Number(depositAmount) * 100);
    if (!Number.isInteger(cents) || cents <= 0) {
      setError("Enter a deposit greater than zero.");
      return;
    }
    setBusy(true);
    try {
      const saved = await post("/api/pos/deposits", { amount_cents: cents }, crypto.randomUUID());
      setDepositAmount("");
      setSheet(null);
      if (typeof saved.deposit_code === "string") setDepositCode(saved.deposit_code);
      await load();
    } catch (err) {
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveCloseCount(sku: string, countedQty: number) {
    setError("");
    await post("/api/pos/shift/count", { sku, counted_qty: countedQty });
    await load();
  }

  async function saveCloseDeposit(cents: number) {
    setError("");
    const saved = await post("/api/pos/shift/final-deposit", { amount_cents: cents });
    await load();
    return { deposit_code: typeof saved.deposit_code === "string" ? saved.deposit_code : null };
  }

  async function confirmEnd(depositCents: number) {
    setError("");
    setBusy(true);
    try {
      const lines = (view?.close_lines ?? []).map((line) => ({ sku: line.sku, counted_qty: line.counted_qty ?? 0 }));
      await post("/api/pos/shift/end", { lines, final_deposit_cents: depositCents }, crypto.randomUUID());
      setSheet(null);
      setCart({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end the shift");
    } finally {
      setBusy(false);
    }
  }

  async function saveVerifyLine(sku: string, countedQty: number) {
    if (view?.master) return;
    setError("");
    await post("/api/pos/counts/opening-line", { sku, counted_qty: countedQty });
    await load();
  }

  async function saveOpeningLine(sku: string, countedQty: number, varianceReason?: string) {
    setError("");
    await post("/api/pos/counts/opening-line", { sku, counted_qty: countedQty, variance_reason: varianceReason });
    await load();
  }

  async function confirmOpening() {
    setError("");
    setBusy(true);
    try {
      const lines = (view?.opening_lines ?? []).map((line) => ({
        sku: line.sku,
        counted_qty: line.counted_qty ?? 0,
        variance_reason: line.variance_reason || undefined,
      }));
      await post("/api/pos/counts/opening", { lines }, crypto.randomUUID());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Count was not saved");
    } finally {
      setBusy(false);
    }
  }

  async function receiveRefills(lines: { kitchen_row_id: string; qty_received: number }[]) {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/incoming/confirm", { lines }, crypto.randomUUID());
      setRefillOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refill was not saved");
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <main className={styles.shell}>Loading till…</main>;

  if (!view.authenticated) {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"];
    return (
      <main className={styles.shell} data-testid="pos-login">
        {view.demo ? <div className={styles.demo}>{view.demo_label} · PIN {view.demo_pin}</div> : null}
        <section className={styles.pin}>
          <h1 className={styles.brand}>PNY01 staff till</h1>
          <p>Enter the 4-digit shift PIN. Five wrong tries lock the shift.</p>
          <div className={styles.pinDisplay} aria-live="polite">{pin.replace(/./g, "•") || " "}</div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.keys}>
            {digits.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => {
                  if (digit === "Clear") setPin("");
                  else if (digit === "⌫") setPin((current) => current.slice(0, -1));
                  else setPin((current) => (current + digit).slice(0, 4));
                }}
              >
                {digit}
              </button>
            ))}
          </div>
          <button className={styles.primary} type="button" disabled={pin.length !== 4 || busy} onClick={() => void signIn()} style={{ width: "100%", marginTop: 12 }}>
            Sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="pos-shell">
      {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
      <header className={`${styles.header} ${styles.posHeader}`}>
        <div className={styles.headerTop}>
          <div className={styles.brand}>PNY01 · {view.shift?.staff_name}{view.master ? " · Master view" : ""}</div>
          {view.phase === "sell" ? (
            <button className={styles.cornerBtn} type="button" data-testid="customer-qr" onClick={() => setQrOpen(true)}>Customer QR</button>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          {view.phase === "sell" ? (
            <button className={styles.cornerBtn} type="button" data-testid="pos-refill" onClick={() => setRefillOpen(true)}>
              Refill
              {(view.incoming?.length ?? 0) > 0 ? <span className={styles.refillBadge} data-testid="refill-badge">{view.incoming?.length}</span> : null}
            </button>
          ) : null}
          {view.phase === "sell" ? (
            <button className={styles.cornerBtn} type="button" data-testid="pos-summary" onClick={() => { setError(""); setSummaryPin(""); setSheet("summary-pin"); }}>Summary</button>
          ) : null}
          <Link className={styles.tillLink} href="/pos/till" data-testid="open-till">Till</Link>
          <button className={styles.ghost} type="button" disabled={view.master} onClick={() => void openEnd()}>End Shift</button>
          {view.phase === "sell" ? (
            <button className={styles.cornerBtn} type="button" data-testid="pos-deposit" disabled={view.master} onClick={openDeposit}>+Deposit</button>
          ) : null}
        </div>
      </header>
      {view.verify?.reveal && sheet == null ? (
        <section className={styles.gapPanel} data-testid="staff-gaps">
          <h2>Previous shift</h2>
          <p data-testid="staff-gap-count">{view.verify.opening_off ?? 0} SKUs off</p>
          <SkuOffList lines={view.verify.opening_lines ?? []} testId="staff-gap-list" />
        </section>
      ) : null}
      {view.sheet_sync_delayed ? <div className={styles.delayed}>Sheet sync delayed</div> : null}
      {view.block === "WAITING_FOR_KITCHEN" ? <div className={styles.banner} data-testid="waiting-kitchen">No stock assigned yet — waiting for Kitchen</div> : null}
      {error && !sheet && !refillOpen ? <p className={styles.error} style={{ padding: "0 12px" }}>{error}</p> : null}

      {view.phase === "opening" ? (
        <OpeningCount
          lines={view.opening_lines ?? []}
          busy={busy}
          error={error}
          onSave={saveOpeningLine}
          onConfirm={confirmOpening}
        />
      ) : null}

      {refillOpen ? <RefillList lines={view.incoming ?? []} busy={busy} viewOnly={Boolean(view.master)} onClose={() => setRefillOpen(false)} onReceive={receiveRefills} /> : null}

      {view.phase === "sell" && tab === "sell" ? (
        <section className={styles.body} data-testid="pos-sell">
          <div className={styles.searchWrap}>
            <label className="sr-only" htmlFor="pos-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>Search SKU or name</label>
            <input id="pos-search" className={styles.search} placeholder="Search SKU or name" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className={styles.chips} role="tablist" aria-label="Categories">
            {categories.map((chip) => (
              <button key={chip} type="button" role="tab" aria-selected={chip === activeCategory} data-category={chip} className={chip === activeCategory ? styles.chipOn : styles.chip} onClick={() => setCategory(chip)}>
                {chip}
              </button>
            ))}
          </div>
          {blocks.map((block) => {
            if (block.kind === "strain") {
              return (
                <article key={`${block.category}-${block.base}`} className={styles.strainRow} data-strain={block.base} data-layout="list">
                  <div className={styles.strainHead}>
                    <span className={styles.sku}>{block.base}</span>
                    <span className={styles.listName}>{block.name}</span>
                    {[block.sizes[0]?.flower_type, block.sizes[0]?.thc].filter(Boolean).length > 0 ? <span className={styles.strainDetail}>{[block.sizes[0]?.flower_type, block.sizes[0]?.thc].filter(Boolean).join(" · ")}</span> : null}
                  </div>
                  <div className={styles.sizeRow}>
                    {block.sizes.map((product) => {
                      const size = bagLabel(product.sku);
                      const qty = cart[product.sku] ?? 0;
                      return (
                        <div key={product.sku} className={styles.sizePick}>
                          <button type="button" className={qty > 0 ? styles.sizeOn : styles.sizeBtn} data-add={product.sku} data-size={size} aria-label={`${block.name} ${size}`} onClick={() => setQty(product, qty + 1)}>
                            {size} {formatMoney(product.price_cents)}{qty > 0 ? ` ×${qty}` : ""}
                          </button>
                          {qty > 0 ? <button type="button" className={styles.sizeMinus} aria-label={`Decrease ${product.name}`} onClick={() => setQty(product, qty - 1)}>−</button> : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            }
            const product = block.item;
            const qty = cart[product.sku] ?? 0;
            const stepper = (
              <div className={styles.stepper}>
                <button type="button" aria-label={`Decrease ${product.name}`} disabled={qty === 0} onClick={() => setQty(product, qty - 1)}>−</button>
                <strong>{qty}</strong>
                <button type="button" aria-label={`Increase ${product.name}`} data-add={product.sku} onClick={() => setQty(product, qty + 1)}>+</button>
              </div>
            );
            return (
              <article key={product.sku} className={styles.row} data-sku={product.sku}>
                <ProductPhoto src={product.image_url} alt="" className={styles.thumb} placeholderClassName={styles.thumbPh} />
                <div>
                  <div className={styles.name}>{product.name}</div>
                  <div className={styles.meta}>{product.sku} · {formatMoney(product.price_cents)}</div>
                </div>
                {stepper}
              </article>
            );
          })}
        </section>
      ) : null}

      {view.phase === "sell" && tab === "tickets" ? (
        <section className={styles.body} data-testid="pos-tickets">
          {(view.tickets ?? []).length === 0 ? <p className={styles.pad}>No pending tickets.</p> : null}
          {(view.tickets ?? []).map((ticket) => (
            <article key={ticket.id} className={styles.ticket}>
              <code>{ticket.code}</code>
              <div className={styles.meta}>{ticket.status} · {ticket.lines.map((line) => `${line.qty} ${line.name}`).join(", ")}</div>
              <div className={styles.actions} style={{ marginTop: 8 }}>
                <button className={styles.primary} type="button" onClick={() => {
                  const next: Record<string, number> = {};
                  for (const line of ticket.lines) next[line.sku] = line.qty;
                  setCart(next);
                  setActiveTicket({ id: ticket.id, code: ticket.code });
                  setTab("sell");
                  void post(`/api/pos/tickets/${ticket.id}/open`, {}).then(() => load());
                }}>Open</button>
                <button className={styles.secondary} type="button" onClick={() => void post(`/api/pos/tickets/${ticket.id}/cancel`, {}).then(() => load())}>Cancel</button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {view.phase === "sell" ? (
        <footer className={styles.footer} data-testid="pos-dock">
          {view.verify?.waiting ? (
            <div className={`${styles.verifyBanner} ${styles.verifySlim}`} data-testid="verify-banner">Master view · timer starts at the first staff login</div>
          ) : null}
          {verifyOpen && view.verify?.deadline_at ? <VerifyBanner slim deadline={view.verify.deadline_at} /> : null}
          {showVerify ? (
            <CountCard compact lines={view.verify?.lines ?? []} busy={busy || Boolean(view.master)} allowExtra onSave={saveVerifyLine} />
          ) : null}
          <div className={styles.footerBar}>
            <div className={styles.cartCompact}>
              <span className={styles.metricLabel}>Cart</span>
              <strong className={styles.total} data-testid="cart-total">{formatMoney(total)}</strong>
            </div>
            <button className={styles.clearCart} type="button" data-testid="clear-cart" disabled={cartEmpty} onClick={clearCart}>Clear</button>
            <button className={styles.cash} type="button" disabled={total === 0 || !view.can_sell} onClick={() => { setError(""); setSheet("cash"); }}>Cashout</button>
            <button type="button" className={tab === "sell" ? `${styles.tabChip} ${styles.tabOn}` : styles.tabChip} onClick={() => setTab("sell")}>Sell</button>
            <button type="button" className={tab === "tickets" ? `${styles.tabChip} ${styles.tabOn}` : styles.tabChip} data-testid="tickets-tab" onClick={() => setTab("tickets")}>Tickets {view.pending_count ?? 0}</button>
          </div>
        </footer>
      ) : null}

      {sheet === "close" ? (
        <CloseShift
          lines={view.close_lines ?? []}
          totals={{
            sales_cents: view.totals?.sales_cents ?? 0,
            cash_sales_cents: view.totals?.cash_sales_cents ?? view.totals?.sales_cents ?? 0,
            debit_sales_cents: view.totals?.debit_sales_cents ?? 0,
            cash_on_hand_cents: view.totals?.cash_on_hand_cents ?? 0,
            deposited_cents: view.totals?.deposited_cents ?? 0,
          }}
          savedDeposit={view.final_deposit_cents ?? null}
          busy={busy}
          error={error}
          onSaveCount={saveCloseCount}
          onSaveDeposit={saveCloseDeposit}
          onConfirm={confirmEnd}
          onClose={() => setSheet(null)}
          stockCheck={view.stock_check}
          deadline={verifyOpen ? view.verify?.deadline_at ?? null : null}
        />
      ) : null}
      {summaryText ? (
        <div className={styles.summaryPage} data-testid="shift-summary">
          <button className={styles.qrClose} type="button" aria-label="Close" onClick={() => setSummaryText("")}>×</button>
          <h2>Today's Summary</h2>
          {summaryDeposits.length > 0 ? (
            <div className={styles.depositList} data-testid="summary-deposits">
              {summaryDeposits.map((row) => (
                <div key={`${row.at}-${row.amount_cents}`} className={styles.depositLine}>
                  <span>{row.deposit_code || "n/a"}</span>
                  <strong>{formatMoney(row.amount_cents)}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <pre className={styles.summaryText}>{summaryText}</pre>
          <button className={styles.primary} type="button" data-testid="copy-summary" onClick={() => void copySummary()}>Copy</button>
          {copied ? <p className={styles.copied} data-testid="copied-toast">Copied</p> : null}
        </div>
      ) : null}
      {qrOpen ? <CustomerQr onClose={() => setQrOpen(false)} /> : null}
      {depositCode ? <DepositSlip code={depositCode} onDone={() => setDepositCode(null)} /> : null}
      {sheet && sheet !== "close" ? (
        <div className={styles.sheet} role="dialog" aria-modal="true">
          <div className={styles.panel} data-testid="pos-sheet">
            {sheet === "cash" ? (
              <>
                <h2>Cashout {formatMoney(total)}</h2>
                <p>Pick Cash or Debit. Debit is recorded only. No card is charged.</p>
                {activeTicket ? <p>Ticket {activeTicket.code} will be marked paid.</p> : null}
                {Object.entries(cart).map(([sku, qty]) => {
                  const product = products.find((item) => item.sku === sku);
                  return <p key={sku}>{qty} × {product?.name} · {formatMoney((product?.price_cents ?? 0) * qty)}</p>;
                })}
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.pay}>
                  <button className={styles.primary} type="button" disabled={busy} onClick={() => void cashout("CASH")}>Cash</button>
                  <button className={styles.secondary} type="button" disabled={busy} onClick={() => void cashout("DEBIT")}>Debit</button>
                </div>
                <button className={styles.secondary} type="button" onClick={() => setSheet(null)}>Back</button>
              </>
            ) : null}
            {sheet === "done" ? (
              <>
                <h2>Sale {refNo}</h2>
                <p>Recorded.</p>
                <button className={styles.primary} type="button" onClick={() => setSheet(null)}>Done</button>
              </>
            ) : null}
            {sheet === "summary-pin" ? (
              <>
                <h2>Summary</h2>
                <p>Enter the shift PIN.</p>
                <div className={styles.pinDisplay} aria-live="polite">{summaryPin.replace(/./g, "•") || " "}</div>
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.keys}>
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"].map((digit) => (
                    <button key={digit} type="button" onClick={() => {
                      if (digit === "Clear") setSummaryPin("");
                      else if (digit === "⌫") setSummaryPin((current) => current.slice(0, -1));
                      else setSummaryPin((current) => (current + digit).slice(0, 4));
                    }}>{digit}</button>
                  ))}
                </div>
                <button className={styles.primary} type="button" disabled={busy || summaryPin.length !== 4} onClick={() => void openSummary()}>Continue</button>
                <button className={styles.secondary} type="button" onClick={() => { setSummaryPin(""); setSheet(null); }}>Back</button>
              </>
            ) : null}
            {sheet === "deposit-pin" ? (
              <>
                <h2>Deposit</h2>
                <p>Enter the shift PIN.</p>
                <div className={styles.pinDisplay} aria-live="polite">{depositPin.replace(/./g, "•") || " "}</div>
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.keys}>
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => {
                        if (digit === "Clear") setDepositPin("");
                        else if (digit === "⌫") setDepositPin((current) => current.slice(0, -1));
                        else setDepositPin((current) => (current + digit).slice(0, 4));
                      }}
                    >
                      {digit}
                    </button>
                  ))}
                </div>
                <button className={styles.primary} type="button" disabled={busy || depositPin.length !== 4} onClick={() => void confirmDepositPin()}>Continue</button>
                <button className={styles.secondary} type="button" onClick={() => { setDepositPin(""); setSheet(null); }}>Back</button>
              </>
            ) : null}
            {sheet === "deposit-amount" ? (
              <>
                <h2>Deposit</h2>
                <input className={styles.field} inputMode="decimal" aria-label="Deposit amount" placeholder="0.00" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
                {error ? <p className={styles.error}>{error}</p> : null}
                <button className={styles.primary} type="button" disabled={busy} onClick={() => void saveDeposit()}>Save deposit</button>
                <button className={styles.secondary} type="button" onClick={() => { setDepositAmount(""); setSheet(null); }}>Back</button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
