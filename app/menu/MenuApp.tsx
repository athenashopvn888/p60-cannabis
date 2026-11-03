"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import { ProductPhoto } from "../pos/ProductPhoto";
import styles from "./menu.module.css";

type Item = { sku: string; name: string; category: string; price_cents: number; image_url?: string | null; availability: string };
type Menu = {
  demo?: boolean;
  demo_label?: string | null;
  ordering?: boolean;
  prices_include_tax?: boolean;
  items?: Item[];
};
type Layout = "grid" | "list";

const LAYOUT_KEY = "pny-menu-layout";
const layoutListeners = new Set<() => void>();

function readLayout(): Layout {
  const saved = window.localStorage.getItem(LAYOUT_KEY);
  return saved === "list" ? "list" : "grid";
}

function subscribeLayout(listener: () => void) {
  layoutListeners.add(listener);
  return () => layoutListeners.delete(listener);
}

function chooseLayout(next: Layout) {
  window.localStorage.setItem(LAYOUT_KEY, next);
  layoutListeners.forEach((listener) => listener());
}

export default function MenuApp() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ticket, setTicket] = useState<{ code: string; total_cents: number; expires_at: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const layout = useSyncExternalStore(subscribeLayout, readLayout, () => "grid" as Layout);

  useEffect(() => {
    let stop = false;
    const load = () => {
      void fetch("/api/menu", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: Menu) => {
          if (!stop) setMenu(data);
        });
    };
    load();
    const timer = window.setInterval(load, 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  const items = menu?.items ?? [];
  const total = items.reduce((sum, item) => sum + (cart[item.sku] ?? 0) * item.price_cents, 0);
  const lines = Object.entries(cart).filter(([, qty]) => qty > 0);

  async function place() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/menu/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ lines: lines.map(([sku, qty]) => ({ sku, qty })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not place the order");
      setTicket({ code: data.code, total_cents: data.total_cents, expires_at: data.expires_at });
      setCart({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order");
    } finally {
      setBusy(false);
    }
  }

  if (ticket) {
    return (
      <main className={styles.shell} data-testid="menu-ticket">
        {menu?.demo ? <div className={styles.demo}>{menu.demo_label}</div> : null}
        <section className={styles.ticket}>
          <p>Show this code to staff</p>
          <strong data-testid="ticket-code">{ticket.code}</strong>
          <p>{formatMoney(ticket.total_cents)}</p>
          <p className={styles.note}>Prices include tax. Valid for 30 minutes. Stock is taken when staff cash it out.</p>
          <button className={styles.order} type="button" onClick={() => setTicket(null)}>Order something else</button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="menu-shell">
      {menu?.demo ? <div className={styles.demo}>{menu.demo_label}</div> : null}
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1>PNY01 order</h1>
          <div className={styles.toggle} role="group" aria-label="Menu layout">
            <button type="button" aria-pressed={layout === "grid"} className={layout === "grid" ? styles.toggleOn : styles.toggleOff} onClick={() => chooseLayout("grid")}>Grid</button>
            <button type="button" aria-pressed={layout === "list"} className={layout === "list" ? styles.toggleOn : styles.toggleOff} onClick={() => chooseLayout("list")}>List</button>
          </div>
        </div>
        <p>{menu?.prices_include_tax === false ? "" : "Prices include tax."} Only available items are listed.</p>
      </header>
      <section className={layout === "list" ? styles.list : styles.grid} data-layout={layout}>
        {items.map((item) => {
          const qty = cart[item.sku] ?? 0;
          return (
            <article key={item.sku} className={styles.card}>
              <ProductPhoto src={item.image_url} alt={item.name} className={styles.hero} placeholderClassName={styles.heroPh} />
              <div className={styles.name}>{item.name}</div>
              <div className={styles.price}>{formatMoney(item.price_cents)}</div>
              <span className={styles.available}>{item.availability}</span>
              <div className={styles.stepper}>
                <button type="button" aria-label={`Decrease ${item.name}`} disabled={qty === 0} onClick={() => setCart({ ...cart, [item.sku]: qty - 1 })}>−</button>
                <strong>{qty}</strong>
                <button type="button" aria-label={`Increase ${item.name}`} data-add={item.sku} disabled={!menu?.ordering || qty >= 20} onClick={() => setCart({ ...cart, [item.sku]: qty + 1 })}>+</button>
              </div>
            </article>
          );
        })}
      </section>
      <footer className={styles.footer}>
        <div>
          <strong>{formatMoney(total)}</strong>
          {error ? <div className={styles.note}>{error}</div> : null}
          {!menu?.ordering ? <div className={styles.note}>Ordering is unavailable right now.</div> : null}
        </div>
        <button className={styles.order} type="button" disabled={!menu?.ordering || lines.length === 0 || busy} onClick={() => void place()}>
          Place order
        </button>
      </footer>
    </main>
  );
}
