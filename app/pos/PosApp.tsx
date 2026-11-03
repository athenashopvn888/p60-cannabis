"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import { ProductPhoto } from "./ProductPhoto";
import styles from "./till.module.css";

type Product = { sku: string; name: string; category: string; price_cents: number; image_url?: string | null; qty: number };
type Ticket = { id: string; code: string; status: string; expires_at: string; lines: { sku: string; name: string; qty: number }[] };
type CountLine = { sku: string; name: string; system_qty: number };
type View = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  demo_pin?: string | null;
  phase?: string;
  can_sell?: boolean;
  block?: string | null;
  shift?: { staff_name: string; pos_id: string; status: string; ticket_letter: string };
  totals?: { sales_cents: number; cash_on_hand_cents: number; deposited_cents: number };
  categories?: string[];
  products?: Product[];
  count_lines?: CountLine[];
  incoming?: { kitchen_row_id: string; sku: string; name: string; qty_sent: number; kind: string }[];
  tickets?: Ticket[];
  pending_count?: number;
  sheet_sync_delayed?: boolean;
  end_shift_message?: string;
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
  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"sell" | "tickets">("sell");
  const [sheet, setSheet] = useState<"cash" | "deposit" | "end" | "done" | null>(null);
  const [deposit, setDeposit] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [refNo, setRefNo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/pos/state", { cache: "no-store", credentials: "same-origin" });
    const data = (await response.json()) as View;
    setView(data);
    if (!data.authenticated) {
      setCart({});
      if (data.error) setError(data.code ? `${data.error} (${data.code})` : data.error);
    }
  }, []);

  useEffect(() => {
    let stop = false;
    const run = () => {
      if (!stop) void load();
    };
    run();
    const timer = window.setInterval(run, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [load]);

  const products = view?.products ?? [];
  const visible = useMemo(() => {
    const rows = view?.products ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((product) => {
      if (category !== "All" && product.category !== category) return false;
      if (!q) return true;
      return product.sku.includes(q) || product.name.toLowerCase().includes(q);
    });
  }, [view?.products, query, category]);

  const total = products.reduce((sum, product) => sum + (cart[product.sku] ?? 0) * product.price_cents, 0);

  function setQty(product: Product, next: number) {
    const qty = Math.max(0, Math.min(product.qty, next));
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

  async function cashout() {
    setError("");
    setBusy(true);
    try {
      const lines = Object.entries(cart).map(([sku, qty]) => ({ sku, qty }));
      const result = await post("/api/pos/cashout", { lines }, crypto.randomUUID());
      setRefNo(String(result.ref_no));
      setCart({});
      setSheet("done");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cashout failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendDeposit() {
    setError("");
    const cents = Math.round(Number(deposit) * 100);
    setBusy(true);
    try {
      await post("/api/pos/deposits", { amount_cents: cents }, crypto.randomUUID());
      setDeposit("");
      setSheet(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  async function openEnd() {
    setError("");
    const lines = view?.count_lines ?? [];
    const next: Record<string, string> = {};
    for (const line of lines) next[line.sku] = String(line.system_qty);
    setCounts(next);
    setReasons({});
    setSheet("end");
  }

  async function confirmEnd() {
    setError("");
    setBusy(true);
    try {
      const lines = (view?.count_lines ?? []).map((line) => ({
        sku: line.sku,
        counted_qty: Number(counts[line.sku]),
        variance_reason: reasons[line.sku] || undefined,
      }));
      await post("/api/pos/shift/end", { lines }, crypto.randomUUID());
      setSheet(null);
      setCart({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end the shift");
    } finally {
      setBusy(false);
    }
  }

  async function confirmOpening() {
    setError("");
    setBusy(true);
    try {
      const lines = (view?.count_lines ?? []).map((line) => ({
        sku: line.sku,
        counted_qty: Number(counts[line.sku] ?? line.system_qty),
        variance_reason: reasons[line.sku] || undefined,
      }));
      await post("/api/pos/counts/opening", { lines }, crypto.randomUUID());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Count was not saved");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefill() {
    setError("");
    setBusy(true);
    try {
      const lines = (view?.incoming ?? []).map((row) => ({
        kitchen_row_id: row.kitchen_row_id,
        qty_received: Number(counts[row.kitchen_row_id] ?? row.qty_sent),
        variance_reason: reasons[row.kitchen_row_id] || undefined,
      }));
      await post("/api/pos/incoming/confirm", { lines }, crypto.randomUUID());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receipt was not saved");
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
          <p>Enter the 6-digit shift PIN.</p>
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
                  else setPin((current) => (current + digit).slice(0, 6));
                }}
              >
                {digit}
              </button>
            ))}
          </div>
          <button className={styles.primary} type="button" disabled={pin.length !== 6 || busy} onClick={() => void signIn()} style={{ width: "100%", marginTop: 12 }}>
            Sign in
          </button>
        </section>
      </main>
    );
  }

  const message = view.end_shift_message || "Summary will post to BOT HUB within 5 min.";

  return (
    <main className={styles.shell} data-testid="pos-shell">
      {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.brand}>PNY01 · {view.shift?.staff_name}</div>
          <button className={styles.ghost} type="button" onClick={() => void openEnd()}>End Shift</button>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric} data-testid="total-sales">
            <span>Total Sales</span>
            <strong>{formatMoney(view.totals?.sales_cents ?? 0)}</strong>
          </div>
          <div className={styles.metric} data-testid="cash-on-hand">
            <span>Cash on Hand</span>
            <strong>{formatMoney(view.totals?.cash_on_hand_cents ?? 0)}</strong>
          </div>
          <div className={styles.metric} data-testid="total-deposited">
            <span>Total Deposited</span>
            <strong>{formatMoney(view.totals?.deposited_cents ?? 0)}</strong>
          </div>
          <button className={styles.depositBtn} type="button" onClick={() => { setError(""); setSheet("deposit"); }}>+Deposit</button>
        </div>
      </header>
      {view.sheet_sync_delayed ? <div className={styles.delayed}>Sheet sync delayed</div> : null}
      {(view.incoming?.length ?? 0) > 0 ? <div className={styles.banner}>Incoming stock is waiting to be confirmed.</div> : null}
      {error && !sheet ? <p className={styles.error} style={{ padding: "0 12px" }}>{error}</p> : null}

      {view.phase === "opening" ? (
        <section className={styles.body} data-testid="pos-opening">
          <div className={styles.pad}><h2>Opening count</h2><p>Confirm original stock. A difference needs a reason.</p></div>
          {(view.count_lines ?? []).map((line) => (
            <div key={line.sku}>
              <label className={styles.countRow}>
                <span><strong>{line.sku}</strong> {line.name}<br />System {line.system_qty}</span>
                <input inputMode="numeric" value={counts[line.sku] ?? String(line.system_qty)} onChange={(event) => setCounts({ ...counts, [line.sku]: event.target.value })} />
              </label>
              {Number(counts[line.sku] ?? line.system_qty) !== line.system_qty ? (
                <input className={styles.reason} placeholder="Reason" value={reasons[line.sku] ?? ""} onChange={(event) => setReasons({ ...reasons, [line.sku]: event.target.value })} style={{ margin: "0 12px 8px", width: "calc(100% - 24px)" }} />
              ) : null}
            </div>
          ))}
          <div className={styles.pad}><button className={styles.primary} type="button" disabled={busy} onClick={() => void confirmOpening()}>Confirm original stock</button></div>
        </section>
      ) : null}

      {view.phase === "refill" ? (
        <section className={styles.body} data-testid="pos-refill">
          <div className={styles.pad}><h2>Confirm refill</h2><p>Enter the quantity received. A difference needs a reason.</p></div>
          {(view.incoming ?? []).map((row) => {
            const received = Number(counts[row.kitchen_row_id] ?? row.qty_sent);
            return (
              <div key={row.kitchen_row_id}>
                <label className={styles.countRow}>
                  <span><strong>{row.sku}</strong> {row.name}<br />Sent {row.qty_sent}</span>
                  <input inputMode="numeric" value={counts[row.kitchen_row_id] ?? String(row.qty_sent)} onChange={(event) => setCounts({ ...counts, [row.kitchen_row_id]: event.target.value })} />
                </label>
                {received !== row.qty_sent ? (
                  <input className={styles.reason} placeholder="Reason" aria-label={`Reason for ${row.sku}`} value={reasons[row.kitchen_row_id] ?? ""} onChange={(event) => setReasons({ ...reasons, [row.kitchen_row_id]: event.target.value })} style={{ margin: "0 12px 8px", width: "calc(100% - 24px)" }} />
                ) : null}
              </div>
            );
          })}
          <div className={styles.pad}><button className={styles.primary} type="button" disabled={busy} onClick={() => void confirmRefill()}>Confirm received</button></div>
        </section>
      ) : null}

      {view.phase === "sell" && tab === "sell" ? (
        <section className={styles.body} data-testid="pos-sell">
          <div className={styles.searchWrap}>
            <label className="sr-only" htmlFor="pos-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>Search SKU or name</label>
            <input id="pos-search" className={styles.search} placeholder="Search SKU or name" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className={styles.chips}>
            {["All", ...(view.categories ?? [])].map((chip) => (
              <button key={chip} type="button" className={chip === category ? styles.chipOn : styles.chip} onClick={() => setCategory(chip)}>{chip}</button>
            ))}
          </div>
          {visible.map((product) => {
            const qty = cart[product.sku] ?? 0;
            return (
              <article key={product.sku} className={styles.row} data-sku={product.sku}>
                <ProductPhoto src={product.image_url} alt="" className={styles.thumb} placeholderClassName={styles.thumbPh} />
                <div>
                  <div className={styles.name}>{product.name}</div>
                  <div className={styles.meta}>{product.sku} · {formatMoney(product.price_cents)} tax incl. · {product.qty} demo stock</div>
                </div>
                <div className={styles.stepper}>
                  <button type="button" aria-label={`Decrease ${product.name}`} disabled={qty === 0} onClick={() => setQty(product, qty - 1)}>−</button>
                  <strong>{qty}</strong>
                  <button type="button" aria-label={`Increase ${product.name}`} disabled={qty >= product.qty} data-add={product.sku} onClick={() => setQty(product, qty + 1)}>+</button>
                </div>
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
                  for (const line of ticket.lines) {
                    const product = products.find((item) => item.sku === line.sku);
                    next[line.sku] = Math.min(line.qty, product?.qty ?? line.qty);
                  }
                  setCart(next);
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
        <footer className={styles.footer}>
          <div className={styles.footerMain}>
            <div>
              <div className={styles.metricLabel}>Cart</div>
              <div className={styles.total} data-testid="cart-total">{formatMoney(total)}</div>
            </div>
            <button className={styles.cash} type="button" disabled={total === 0 || !view.can_sell} onClick={() => { setError(""); setSheet("cash"); }}>Cashout</button>
          </div>
          <div className={styles.tabs}>
            <button type="button" className={tab === "sell" ? styles.tabOn : undefined} onClick={() => setTab("sell")}>Sell</button>
            <button type="button" className={tab === "tickets" ? styles.tabOn : undefined} data-testid="tickets-tab" onClick={() => setTab("tickets")}>Tickets {view.pending_count ?? 0}</button>
          </div>
        </footer>
      ) : null}

      {sheet ? (
        <div className={styles.sheet} role="dialog" aria-modal="true">
          <div className={styles.panel} data-testid={sheet === "end" ? "pos-end" : "pos-sheet"}>
            {sheet === "cash" ? (
              <>
                <h2>Cashout {formatMoney(total)}</h2>
                <p>Prices include tax. Recorded as cash. No payment is taken.</p>
                {Object.entries(cart).map(([sku, qty]) => {
                  const product = products.find((item) => item.sku === sku);
                  return <p key={sku}>{qty} × {product?.name} · {formatMoney((product?.price_cents ?? 0) * qty)}</p>;
                })}
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.actions}>
                  <button className={styles.secondary} type="button" onClick={() => setSheet(null)}>Back</button>
                  <button className={styles.primary} type="button" disabled={busy} onClick={() => void cashout()}>Confirm</button>
                </div>
              </>
            ) : null}
            {sheet === "done" ? (
              <>
                <h2>Sale {refNo}</h2>
                <p>Prices include tax.</p>
                <button className={styles.primary} type="button" onClick={() => setSheet(null)}>Done</button>
              </>
            ) : null}
            {sheet === "deposit" ? (
              <>
                <h2>+Deposit</h2>
                <p>Cash on hand is {formatMoney(view.totals?.cash_on_hand_cents ?? 0)}. A larger deposit is blocked.</p>
                <input className={styles.field} inputMode="decimal" placeholder="0.00" value={deposit} onChange={(event) => setDeposit(event.target.value)} aria-label="Deposit amount" />
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.actions}>
                  <button className={styles.secondary} type="button" onClick={() => setSheet(null)}>Back</button>
                  <button className={styles.primary} type="button" disabled={busy} onClick={() => void sendDeposit()}>Deposit</button>
                </div>
              </>
            ) : null}
            {sheet === "end" ? (
              <>
                <h2>End Shift</h2>
                <p data-testid="end-shift-message">{message}</p>
                <p>Total Sales {formatMoney(view.totals?.sales_cents ?? 0)} · COH {formatMoney(view.totals?.cash_on_hand_cents ?? 0)} · Deposited {formatMoney(view.totals?.deposited_cents ?? 0)} · Tickets {view.pending_count ?? 0} still open</p>
                {(view.count_lines ?? []).map((line) => (
                  <div key={line.sku}>
                    <label className={styles.countRow} style={{ margin: "0 0 8px" }}>
                      <span><strong>{line.sku}</strong> {line.name}<br />System {line.system_qty}</span>
                      <input inputMode="numeric" aria-label={`Left ${line.sku}`} value={counts[line.sku] ?? ""} onChange={(event) => setCounts({ ...counts, [line.sku]: event.target.value })} />
                    </label>
                    {Number(counts[line.sku] ?? line.system_qty) !== line.system_qty ? (
                      <input className={styles.reason} placeholder="Reason" aria-label={`Reason for ${line.sku}`} value={reasons[line.sku] ?? ""} onChange={(event) => setReasons({ ...reasons, [line.sku]: event.target.value })} style={{ marginBottom: 8 }} />
                    ) : null}
                  </div>
                ))}
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.actions}>
                  <button className={styles.secondary} type="button" onClick={() => setSheet(null)}>Back</button>
                  <button className={styles.primary} type="button" disabled={busy} onClick={() => void confirmEnd()}>Confirm end</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
