"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductPhoto } from "../pos/ProductPhoto";
import styles from "./kitchen.module.css";

type Product = { sku: string; name: string; category: string; image_url?: string | null; qty: number };
type CountLine = { sku: string; name: string; system_qty: number };
type Receipt = {
  kitchen_row_id: string;
  sku: string;
  name: string;
  qty_sent: number;
  qty_received: number | null;
  status: string;
  kind: string;
};
type View = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  demo_pin?: string | null;
  shift?: { staff_name: string; opening_confirmed?: boolean; status: string };
  products?: Product[];
  count_lines?: CountLine[];
  receipts?: Receipt[];
  end_shift_message?: string;
  error?: string;
  code?: string;
};
type Tab = "stock" | "send" | "end" | "history";
type Kind = "ALLOCATION" | "REFILL";

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
  return "Something went wrong.";
}

export default function KitchenApp() {
  const [view, setView] = useState<View | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("stock");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("ALLOCATION");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [sendQty, setSendQty] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/pos/state", { cache: "no-store", credentials: "same-origin" });
    const data = (await response.json()) as View;
    setView(data);
    if (!data.authenticated && data.error) setError(data.code ? `${data.error} (${data.code})` : data.error);
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

  const photos = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of view?.products ?? []) map.set(product.sku, product);
    return map;
  }, [view?.products]);

  const q = query.trim().toLowerCase();
  const stockLines = (view?.count_lines ?? []).filter((line) => {
    if (!q) return true;
    return line.sku.includes(q) || line.name.toLowerCase().includes(q);
  });
  const sendLines = (view?.products ?? []).filter((product) => {
    if (!q) return true;
    return product.sku.includes(q) || product.name.toLowerCase().includes(q);
  });

  async function signIn() {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/login", { pin });
      setPin("");
      setTab("stock");
      await load();
    } catch (err) {
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await post("/api/pos/logout", {});
    setView(null);
    await load();
  }

  async function confirmStock() {
    setError("");
    if (view?.shift?.opening_confirmed) {
      setTab("send");
      return;
    }
    setBusy(true);
    try {
      const lines = (view?.count_lines ?? []).map((line) => ({
        sku: line.sku,
        counted_qty: Number(counts[line.sku] ?? line.system_qty),
        variance_reason: reasons[line.sku] || undefined,
      }));
      await post("/api/pos/counts/opening", { lines }, crypto.randomUUID());
      setTab("send");
      await load();
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === "OPENING_DONE") {
        setTab("send");
        return;
      }
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendStock() {
    setError("");
    const lines = Object.entries(sendQty)
      .map(([sku, value]) => ({ sku, qty: Number(value) }))
      .filter((line) => Number.isInteger(line.qty) && line.qty > 0);
    if (lines.length === 0) {
      setError("Enter a quantity for at least one item.");
      return;
    }
    setBusy(true);
    try {
      await post("/api/kitchen/refill", { kind, lines }, crypto.randomUUID());
      setSendQty({});
      await load();
      setTab("history");
    } catch (err) {
      setError(failureText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <main className={styles.shell}>Loading kitchen…</main>;

  if (!view.authenticated) {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"];
    return (
      <main className={styles.shell} data-testid="kitchen-login">
        {view.demo ? <div className={styles.demo}>{view.demo_label} · PIN {view.demo_pin}</div> : null}
        <section className={styles.pin}>
          <h1>PNY01 kitchen</h1>
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
          <button className={styles.primary} type="button" disabled={pin.length !== 4 || busy} onClick={() => void signIn()}>
            Sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="kitchen-shell">
      {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.brand}>Kitchen · {view.shift?.staff_name}</div>
          <button className={styles.ghost} type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
        <div className={styles.tabs}>
          {([
            ["stock", "Stock"],
            ["send", "Send"],
            ["end", "End"],
            ["history", "History"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? styles.tabOn : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </header>
      <div className={styles.body}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {tab === "stock" ? (
          <section data-testid="kitchen-stock">
            <p className={styles.note}>Confirm the original PNY01 stock, then send an allocation or a refill. These quantities are the till, kept separate from the public menu.</p>
            <input className={styles.search} value={query} placeholder="Search name or SKU" aria-label="Search stock" onChange={(event) => setQuery(event.target.value)} />
            {stockLines.map((line) => {
              const photo = photos.get(line.sku);
              const counted = counts[line.sku] ?? String(line.system_qty);
              const changed = Number(counted) !== line.system_qty;
              return (
                <article key={line.sku} className={styles.card}>
                  <ProductPhoto src={photo?.image_url} alt={line.name} className={styles.photo} placeholderClassName={styles.photoPh} />
                  <div>
                    <div className={styles.name}>{line.name}</div>
                    <div className={styles.meta}>{line.sku} · {line.system_qty} on the till</div>
                    {view.shift?.opening_confirmed ? null : (
                      <>
                        <div className={styles.row}>
                          <input className={styles.qty} inputMode="numeric" aria-label={`Count ${line.name}`} value={counted} onChange={(event) => setCounts({ ...counts, [line.sku]: event.target.value })} />
                        </div>
                        {changed ? <input className={styles.reason} placeholder="Reason for the difference" aria-label={`Reason for ${line.name}`} value={reasons[line.sku] ?? ""} onChange={(event) => setReasons({ ...reasons, [line.sku]: event.target.value })} /> : null}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            <button className={styles.primary} type="button" disabled={busy} onClick={() => void confirmStock()}>
              {view.shift?.opening_confirmed ? "Original stock confirmed — send stock" : "Confirm original stock"}
            </button>
          </section>
        ) : null}
        {tab === "send" ? (
          <section data-testid="kitchen-send">
            <p className={styles.note}>Allocation is the first send. Refill adds more during the shift. Both land on the PNY01 till.</p>
            <div className={styles.kind} role="group" aria-label="Send type">
              <button type="button" aria-pressed={kind === "ALLOCATION"} className={kind === "ALLOCATION" ? styles.kindOn : undefined} onClick={() => setKind("ALLOCATION")}>Allocation</button>
              <button type="button" aria-pressed={kind === "REFILL"} className={kind === "REFILL" ? styles.kindOn : undefined} onClick={() => setKind("REFILL")}>Refill</button>
            </div>
            <input className={styles.search} value={query} placeholder="Search name or SKU" aria-label="Search catalog" onChange={(event) => setQuery(event.target.value)} />
            {sendLines.map((product) => (
              <article key={product.sku} className={styles.card}>
                <ProductPhoto src={product.image_url} alt={product.name} className={styles.photo} placeholderClassName={styles.photoPh} />
                <div>
                  <div className={styles.name}>{product.name}</div>
                  <div className={styles.meta}>{product.sku} · {product.category} · {product.qty} on the till</div>
                  <div className={styles.row}>
                    <input className={styles.qty} inputMode="numeric" aria-label={`Send ${product.name}`} placeholder="0" value={sendQty[product.sku] ?? ""} onChange={(event) => setSendQty({ ...sendQty, [product.sku]: event.target.value })} />
                  </div>
                </div>
              </article>
            ))}
            <button className={styles.primary} type="button" disabled={busy} onClick={() => void sendStock()}>
              Send {kind === "ALLOCATION" ? "allocation" : "refill"}
            </button>
          </section>
        ) : null}
        {tab === "end" ? (
          <section data-testid="kitchen-end">
            <p className={styles.note}>{view.end_shift_message || "Summary will post to BOT HUB within 5 min."} The till stays open until staff end it on the POS.</p>
            {(view.count_lines ?? []).map((line) => {
              const photo = photos.get(line.sku);
              return (
                <article key={line.sku} className={styles.card}>
                  <ProductPhoto src={photo?.image_url} alt={line.name} className={styles.photo} placeholderClassName={styles.photoPh} />
                  <div>
                    <div className={styles.name}>{line.name}</div>
                    <div className={styles.meta}>{line.sku} · {line.system_qty} on the till</div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
        {tab === "history" ? (
          <section data-testid="kitchen-history">
            {(view.receipts ?? []).length === 0 ? <p className={styles.note}>No allocation or refill has been sent this shift.</p> : null}
            {(view.receipts ?? []).map((row) => (
              <article key={row.kitchen_row_id} className={styles.history}>
                <strong>{row.name}</strong>
                <div className={styles.meta}>{row.kind} · {row.sku} · sent {row.qty_sent} · received {row.qty_received ?? "—"} · {row.status}</div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
