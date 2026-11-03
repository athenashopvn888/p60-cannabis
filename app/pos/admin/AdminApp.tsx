"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatMoney } from "../../lib/pny-pos/money";
import styles from "./admin.module.css";

const STORES = [{ code: "PNY01", name: "P60 Cannabis" }] as const;
type Tab = "staff" | "hand" | "sales" | "coh" | "deposits" | "total" | "system";

type Shift = { id: string; sccx_shift_id: string; staff_name: string; started_at: string; status: string; pin_failed_attempts: number };
type Product = { sku: string; name: string; category: string; qty: number; enabled: boolean; setb_active: boolean; price_cents: number };
type Line = { sku: string; name: string; qty: number; line_total_cents?: number };
type Sale = { id: string; ref_no: string; total_cents: number; status: string; created_at: string; ticket_code: string | null; void_reason: string | null; lines: Line[] };
type Ticket = { id: string; code: string; status: string; created_at: string; total_cents: number; lines: Line[] };
type Deposit = { id: string; amount_cents: number; note: string | null; created_at: string; staff_name: string };
type Closing = { shift_id: string; late: boolean; acked: boolean; no_count: boolean };
type Outbox = { row_id: string; tab: string; status: string; attempts: number; last_error: string | null };
type Alert = { action: string; created_at: string };

type Admin = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  sheet_configured?: boolean;
  sheet_alert?: boolean;
  sccx_not_acked?: boolean;
  reconciliation?: { ok: boolean };
  summary?: { sales_cents: number; cash_on_hand_cents: number; deposited_cents: number };
  staff_on_shift?: Shift[];
  products?: Product[];
  sales_detail?: Sale[];
  tickets?: Ticket[];
  deposits?: Deposit[];
  closings?: Closing[];
  outbox?: Outbox[];
  alerts?: Alert[];
  error?: string;
};

function when(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export default function AdminApp() {
  const [state, setState] = useState<Admin | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<Tab>("staff");
  const [store, setStore] = useState<(typeof STORES)[number]["code"]>(STORES[0].code);
  const [query, setQuery] = useState("");
  const [confirmEnd, setConfirmEnd] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/state", { cache: "no-store", credentials: "same-origin" });
    if (response.status === 403) {
      setState({ authenticated: false });
      return;
    }
    const data = (await response.json()) as Admin;
    setState({ ...data, authenticated: response.ok });
  }, []);

  useEffect(() => {
    let stop = false;
    const run = () => {
      if (!stop) void load();
    };
    run();
    const timer = window.setInterval(run, 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setMessage("Admin sign-in failed");
      return;
    }
    setPassword("");
    await load();
  }

  async function act(url: string, body: unknown) {
    setMessage("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Request failed");
      return;
    }
    if (data.pin) setPin(String(data.pin));
    setMessage("Saved");
    setConfirmEnd(null);
    await load();
  }

  const summary = state?.summary ?? { sales_cents: 0, cash_on_hand_cents: 0, deposited_cents: 0 };
  const hand = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (state?.products ?? []).filter((product) => product.setb_active);
    const matched = rows.filter((product) => !q || product.sku.includes(q) || product.name.toLowerCase().includes(q));
    const groups = new Map<string, Product[]>();
    for (const product of matched) {
      const key = product.category || "Other";
      groups.set(key, [...(groups.get(key) ?? []), product]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state?.products, query]);

  if (!state) return <main className={styles.shell}>Loading admin…</main>;

  if (!state.authenticated) {
    return (
      <main className={styles.shell} data-testid="admin-login">
        <form className={styles.login} onSubmit={(event) => void login(event)}>
          <h1>PNY01 till admin</h1>
          <p>Demo password, when the local seed is on: demo-admin-secret</p>
          <input className={styles.field} type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Admin password" />
          {message ? <p className={styles.error}>{message}</p> : null}
          <button className={styles.primary} type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  const tabs: [Tab, string][] = [
    ["staff", "Staff"],
    ["hand", "On Hand"],
    ["sales", "Sales"],
    ["coh", "COH"],
    ["deposits", "Deposits"],
    ["total", "Total Sales"],
    ["system", "System"],
  ];

  return (
    <main className={styles.shell} data-testid="admin-shell">
      {state.demo ? <div className={styles.demo}>{state.demo_label}</div> : null}
      <header className={styles.header}>
        <select className={styles.store} aria-label="Store" data-testid="admin-store" value={store} onChange={(event) => setStore(event.target.value as (typeof STORES)[number]["code"])}>
          {STORES.map((item) => (
            <option key={item.code} value={item.code}>{item.code} · {item.name}</option>
          ))}
        </select>
        <div className={styles.brand}>Till admin</div>
        <p className={styles.sub}>Sheet {state.sheet_configured ? "configured" : "local outbox only"} · Reconciliation {state.reconciliation?.ok ? "passes" : "needs a look"}</p>
        <div className={styles.metrics}>
          <div className={styles.metric} data-testid="admin-total-sales"><span>Total Sales</span><strong>{formatMoney(summary.sales_cents)}</strong></div>
          <div className={styles.metric} data-testid="admin-coh"><span>COH</span><strong>{formatMoney(summary.cash_on_hand_cents)}</strong></div>
          <div className={styles.metric} data-testid="admin-deposited"><span>Deposited</span><strong>{formatMoney(summary.deposited_cents)}</strong></div>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Admin views">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} data-testid={`admin-tab-${id}`} className={tab === id ? styles.tabOn : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </header>
      <div className={styles.body}>
        {state.sccx_not_acked ? <div className={styles.banner}>SCCx not acked</div> : null}
        {state.sheet_alert ? <div className={styles.banner}>Sheet sync has been delayed more than 30 minutes.</div> : null}
        {pin ? <div className={styles.notice}>New PIN: {pin}</div> : null}
        {message ? <div className={styles.notice}>{message}</div> : null}

        {tab === "staff" ? (
          <section data-testid="admin-staff">
            {(state.staff_on_shift ?? []).length === 0 ? <p className={styles.empty}>Nobody is on shift.</p> : null}
            {(state.staff_on_shift ?? []).map((shift) => (
              <article key={shift.id} className={styles.card}>
                <div className={styles.who}>{shift.staff_name}</div>
                <div className={styles.meta}>{shift.sccx_shift_id} · {shift.status}</div>
                <div className={styles.meta}>Started {when(shift.started_at)}</div>
                <div className={styles.meta}>PIN fails {shift.pin_failed_attempts}</div>
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" onClick={() => void act("/api/admin/reissue-pin", { shift_id: shift.id })}>Reissue PIN</button>
                  {confirmEnd === shift.id ? (
                    <button className={styles.danger} type="button" onClick={() => void act("/api/admin/kill-shift", { shift_id: shift.id })}>Confirm end</button>
                  ) : (
                    <button className={styles.secondary} type="button" onClick={() => setConfirmEnd(shift.id)}>End Shift</button>
                  )}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {tab === "hand" ? (
          <section data-testid="admin-hand">
            <input className={styles.search} value={query} placeholder="Search SKU or name" aria-label="Search stock" onChange={(event) => setQuery(event.target.value)} />
            {hand.length === 0 ? <p className={styles.empty}>No matching stock.</p> : null}
            {hand.map(([category, products]) => (
              <div key={category} className={styles.group}>
                <h3>{category}</h3>
                <div className={styles.card}>
                  {products.map((product) => (
                    <div key={product.sku} className={styles.row}>
                      <span>{product.sku} · {product.name}</span>
                      <strong>OH {product.qty}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {tab === "sales" ? (
          <section data-testid="admin-sales">
            <h2 className={styles.who}>Sales</h2>
            {(state.sales_detail ?? []).length === 0 ? <p className={styles.empty}>No sales yet.</p> : null}
            {(state.sales_detail ?? []).map((sale) => (
              <article key={sale.id} className={styles.card}>
                <div className={styles.who}>{sale.ref_no} · {formatMoney(sale.total_cents)}</div>
                <div className={styles.meta}>{when(sale.created_at)}{sale.ticket_code ? ` · Ticket ${sale.ticket_code}` : ""}</div>
                <div className={styles.meta}>{sale.lines.map((line) => `${line.qty} ${line.name}`).join(", ") || "No lines"}</div>
                {sale.status === "VOIDED" ? <div className={styles.void}>Voided{sale.void_reason ? ` · ${sale.void_reason}` : ""}</div> : (
                  <div className={styles.actions}>
                    <button className={styles.danger} type="button" onClick={() => void act("/api/admin/void", { sale_id: sale.id, reason: "admin void" })}>Void</button>
                  </div>
                )}
              </article>
            ))}
            <h2 className={styles.who}>Tickets</h2>
            {(state.tickets ?? []).length === 0 ? <p className={styles.empty}>No tickets.</p> : null}
            {(state.tickets ?? []).map((ticket) => (
              <article key={ticket.id} className={styles.card}>
                <div className={styles.who}>Ticket {ticket.code} · {formatMoney(ticket.total_cents)}</div>
                <div className={styles.meta}>{when(ticket.created_at)} · {ticket.status}</div>
                <div className={styles.meta}>{ticket.lines.map((line) => `${line.qty} ${line.name}`).join(", ") || "No lines"}</div>
              </article>
            ))}
          </section>
        ) : null}

        {tab === "coh" ? (
          <section className={styles.card} data-testid="admin-coh-panel">
            <div className={styles.meta}>Cash on hand</div>
            <div className={styles.big}>{formatMoney(summary.cash_on_hand_cents)}</div>
            <div className={styles.meta}>Total sales {formatMoney(summary.sales_cents)} minus deposits {formatMoney(summary.deposited_cents)}.</div>
          </section>
        ) : null}

        {tab === "deposits" ? (
          <section data-testid="admin-deposits">
            <article className={styles.card}>
              <div className={styles.meta}>Deposited</div>
              <div className={styles.big}>{formatMoney(summary.deposited_cents)}</div>
            </article>
            {(state.deposits ?? []).length === 0 ? <p className={styles.empty}>No deposits yet.</p> : null}
            {(state.deposits ?? []).map((deposit) => (
              <article key={deposit.id} className={styles.card}>
                <div className={styles.who}>{formatMoney(deposit.amount_cents)}</div>
                <div className={styles.meta}>{when(deposit.created_at)} · {deposit.staff_name || "Staff"}{deposit.note ? ` · ${deposit.note}` : ""}</div>
              </article>
            ))}
          </section>
        ) : null}

        {tab === "total" ? (
          <section className={styles.card} data-testid="admin-total-panel">
            <div className={styles.meta}>Total sales</div>
            <div className={styles.big}>{formatMoney(summary.sales_cents)}</div>
            <div className={styles.meta}>{(state.sales_detail ?? []).filter((sale) => sale.status === "COMPLETED").length} completed · {(state.sales_detail ?? []).filter((sale) => sale.status === "VOIDED").length} voided</div>
          </section>
        ) : null}

        {tab === "system" ? (
          <section data-testid="admin-system">
            <h2 className={styles.who}>SCCx closings</h2>
            {(state.closings ?? []).length === 0 ? <p className={styles.empty}>No closings yet.</p> : null}
            {(state.closings ?? []).map((closing) => (
              <article key={closing.shift_id} className={styles.card}>
                <div className={styles.who}>{closing.shift_id}</div>
                <div className={styles.meta}>{closing.acked ? "Acked" : closing.late ? "SCCx not acked" : "Waiting"}{closing.no_count ? " · no count" : ""}</div>
              </article>
            ))}
            <h2 className={styles.who}>Outbox</h2>
            {(state.outbox ?? []).length === 0 ? <p className={styles.empty}>Outbox is empty.</p> : null}
            {(state.outbox ?? []).slice(0, 12).map((row) => (
              <article key={row.row_id} className={styles.card}>
                <div className={styles.who}>{row.tab}</div>
                <div className={styles.meta}>{row.row_id} · {row.status} · tries {row.attempts} {row.last_error ?? ""}</div>
              </article>
            ))}
            <h2 className={styles.who}>Alerts</h2>
            {(state.alerts ?? []).length === 0 ? <p className={styles.empty}>No alerts.</p> : null}
            {(state.alerts ?? []).slice(0, 8).map((alert) => (
              <article key={`${alert.action}-${alert.created_at}`} className={styles.card}>
                <div className={styles.who}>{alert.action}</div>
                <div className={styles.meta}>{when(alert.created_at)}</div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
