"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { bagLabel, groupByStrain } from "../lib/pny-pos/flowerSku";
import { categoryChipLabel, defaultCategory, formatMoney, layoutMenuCategoryChips, sortCategories } from "../lib/pny-pos/money";
import { ProductPhoto } from "../pos/ProductPhoto";
import styles from "./menu.module.css";

type Item = { sku: string; name: string; category: string; price_cents: number; image_url?: string | null; availability: string; unit_label?: string; carton_note?: string; flower_type?: string; thc?: string };
type Menu = {
  demo?: boolean;
  demo_label?: string | null;
  ordering?: boolean;
  prices_include_tax?: boolean;
  items?: Item[];
};
type Layout = "grid" | "list";

function rowsOf<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

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
  const [paid, setPaid] = useState(false);
  const [category, setCategory] = useState("");
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
  const categories = useMemo(
    () => sortCategories((menu?.items ?? []).map((item) => item.category)),
    [menu?.items],
  );
  const activeCategory = categories.includes(category) ? category : defaultCategory(categories);
  const categoryRows = useMemo(() => {
    const layout = layoutMenuCategoryChips(categories);
    const wide = defaultCategory(categories);
    const flow = layout.filter((name) => name !== wide);
    return wide ? [...rowsOf(flow, 4), [wide]] : rowsOf(layout, 4);
  }, [categories]);
  const visible = items.filter((item) => item.category === activeCategory);
  const blocks = useMemo(() => groupByStrain(visible), [visible]);
  const total = items.reduce((sum, item) => sum + (cart[item.sku] ?? 0) * item.price_cents, 0);
  const lines = Object.entries(cart).filter(([, qty]) => qty > 0);

  useEffect(() => {
    if (!ticket) return;
    let stop = false;
    const loadStatus = () => {
      void fetch(`/api/menu/tickets/${encodeURIComponent(ticket.code)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { status?: string; paid?: boolean }) => {
          if (!stop && (data.paid || data.status === "PAID")) setPaid(true);
        })
        .catch(() => undefined);
    };
    loadStatus();
    const timer = window.setInterval(loadStatus, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ticket]);

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
      setPaid(false);
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
          <p className={styles.note} data-testid="ticket-status">{paid ? "Paid. This order is closed." : "Valid for 30 minutes. Staff cash this out at the till."}</p>
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
        <p>Only available items are listed.</p>
      </header>
      {categoryRows.length > 0 ? (
        <div className={styles.chipRows} role="tablist" aria-label="Categories" data-testid="menu-categories">
          {categoryRows.map((row) => (
            <div key={row.join("|")} className={styles.chipRow}>
              {row.map((name) => (
                <button key={name} type="button" role="tab" aria-selected={activeCategory === name} data-category={name} className={activeCategory === name ? styles.chipOn : styles.chip} onClick={() => setCategory(name)}>
                  {categoryChipLabel(name)}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <section className={layout === "list" ? styles.list : styles.grid} data-layout={layout}>
        {blocks.map((block) => {
          if (block.kind === "strain") {
            return (
              <article key={`${block.category}-${block.base}`} className={layout === "list" ? styles.listRow : styles.card} data-strain={block.base}>
                {layout === "grid" ? <ProductPhoto src={block.sizes[0]?.image_url} alt="" className={styles.hero} placeholderClassName={styles.heroPh} /> : null}
                <div className={styles.name}>{block.name}</div>
                {[block.sizes[0]?.flower_type, block.sizes[0]?.thc].filter(Boolean).length > 0 ? <div className={styles.note}>{[block.sizes[0]?.flower_type, block.sizes[0]?.thc].filter(Boolean).join(" · ")}</div> : null}
                <div className={styles.sizeRow}>
                  {block.sizes.map((item) => {
                    const size = bagLabel(item.sku);
                    const qty = cart[item.sku] ?? 0;
                    return (
                      <div key={item.sku} className={styles.sizePick}>
                        <button type="button" className={qty > 0 ? styles.sizeOn : styles.sizeBtn} data-add={item.sku} data-size={size} aria-label={`${block.name} ${size}`} disabled={!menu?.ordering || qty >= 20} onClick={() => setCart({ ...cart, [item.sku]: qty + 1 })}>
                          {size} {formatMoney(item.price_cents)}{qty > 0 ? ` ×${qty}` : ""}
                        </button>
                        {qty > 0 ? <button type="button" className={styles.sizeMinus} aria-label={`Decrease ${item.name}`} onClick={() => setCart({ ...cart, [item.sku]: qty - 1 })}>−</button> : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          }
          const item = block.item;
          const qty = cart[item.sku] ?? 0;
          if (layout === "list") {
            return (
              <article key={item.sku} className={styles.listRow}>
                <div className={styles.listCopy}>
                  <div className={styles.name}>{item.name}</div>
                  <div className={styles.price}>{formatMoney(item.price_cents)}{item.unit_label ? ` ${item.unit_label}` : ""}</div>
                  {item.carton_note ? <div className={styles.note}>{item.carton_note}</div> : null}
                </div>
                <div className={styles.compact}>
                  <button type="button" aria-label={`Decrease ${item.name}`} disabled={qty === 0} onClick={() => setCart({ ...cart, [item.sku]: qty - 1 })}>−</button>
                  <strong>{qty}</strong>
                  <button type="button" aria-label={`Increase ${item.name}`} data-add={item.sku} disabled={!menu?.ordering || qty >= 20} onClick={() => setCart({ ...cart, [item.sku]: qty + 1 })}>+</button>
                </div>
              </article>
            );
          }
          return (
            <article key={item.sku} className={styles.card}>
              <ProductPhoto src={item.image_url} alt={item.name} className={styles.hero} placeholderClassName={styles.heroPh} />
              <div className={styles.name}>{item.name}</div>
              <div className={styles.price}>{formatMoney(item.price_cents)}{item.unit_label ? ` ${item.unit_label}` : ""}</div>
              {item.carton_note ? <div className={styles.note}>{item.carton_note}</div> : null}
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
