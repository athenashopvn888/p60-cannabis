"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { formatMoney } from "../../lib/pny-pos/money";
import { usePosPoll } from "../usePosPoll";
import styles from "./kitchen.module.css";

type Row = {
  sku: string;
  name: string;
  size: string;
  category: string;
  price_cents: number;
  on_hand: number;
  thc: boolean;
  updated_at: string | null;
};

type Batch = { batch_id: string | null; action: string; at_toronto: string; lines: { sku?: string; qty?: number; before?: number; after?: number }[] };

type Stock = {
  writes: boolean;
  dry_run: boolean;
  no_weed: boolean;
  shift_open: boolean;
  read_at_toronto: string;
  updated_at_toronto: string;
  sku_count: number;
  units: number;
  retail_cents: number;
  rows: Row[];
  batches: Batch[];
};

type DiffLine = { sku: string; name?: string; size?: string; qty: number; before: number; after: number; thc?: boolean };

async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "Could not save.");
    (error as Error & { code?: string; before?: number; after?: number }).code = data.code;
    throw error;
  }
  return data as Record<string, unknown>;
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function KitchenApp() {
  const [stock, setStock] = useState<Stock | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [refillText, setRefillText] = useState("");
  const [refillPreview, setRefillPreview] = useState<Record<string, unknown> | null>(null);
  const [adjustSku, setAdjustSku] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [reason, setReason] = useState("recount");
  const [note, setNote] = useState("");
  const [adjustPreview, setAdjustPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const paused = useRef(false);

  const load = useCallback(async () => {
    if (paused.current) return;
    try {
      const response = await fetch("/api/pos/kitchen/stock", { cache: "no-store" });
      if (response.status === 401) {
        setStock(null);
        return;
      }
      if (!response.ok) return;
      setStock(await response.json() as Stock);
    } finally {
      setReady(true);
    }
  }, []);

  usePosPoll(load);

  const categories = useMemo(() => ["All", ...new Set((stock?.rows ?? []).map((row) => row.category))], [stock]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (stock?.rows ?? []).filter((row) => {
      if (category !== "All" && row.category !== category) return false;
      if (!needle) return true;
      return `${row.sku} ${row.name} ${row.size} ${row.category}`.toLowerCase().includes(needle);
    });
  }, [stock, query, category]);
  const visibleUnits = visible.reduce((sum, row) => sum + row.on_hand, 0);
  const visibleRetail = visible.reduce((sum, row) => sum + row.on_hand * row.price_cents, 0);

  async function signIn() {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/kitchen/login", { pin });
      setPin("");
      paused.current = false;
      await load();
    } catch (err) {
      setPin("");
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = ["SKU", "Name", "Size", "Category", "Shelf price", "On hand", "THC", "Counted"];
    const lines = visible.map((row) => [row.sku, row.name, row.size, row.category, formatMoney(row.price_cents), row.on_hand, row.thc ? "Y" : "N", ""].map(csvEscape).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pny01-kitchen-stock.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function previewRefill() {
    setError("");
    setBusy(true);
    paused.current = true;
    try {
      setRefillPreview(await post("/api/pos/kitchen/refill", { text: refillText, confirm: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview the refill.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefill() {
    if (!refillPreview) return;
    setError("");
    setBusy(true);
    try {
      const saved = await post("/api/pos/kitchen/refill", {
        text: refillText,
        batch_id: refillPreview.batch_id,
        confirm: true,
      });
      setRefillPreview(saved);
      if (saved.dry_run !== true) {
        setRefillText("");
        setRefillPreview(null);
      }
      paused.current = false;
      await load();
      if (saved.dry_run === true) paused.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the refill.");
    } finally {
      setBusy(false);
    }
  }

  async function previewAdjust() {
    setError("");
    setBusy(true);
    paused.current = true;
    try {
      setAdjustPreview(await post("/api/pos/kitchen/adjust", {
        sku: adjustSku,
        delta: Number(adjustDelta),
        reason,
        note,
        confirm: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview the adjustment.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAdjust(confirmLarge = false) {
    setError("");
    setBusy(true);
    try {
      const saved = await post("/api/pos/kitchen/adjust", {
        sku: adjustSku,
        delta: Number(adjustDelta),
        reason,
        note,
        confirm: true,
        confirm_large: confirmLarge,
      });
      setAdjustPreview(saved);
      if (saved.dry_run !== true) {
        setAdjustDelta("");
        setNote("");
        setAdjustPreview(null);
      }
      paused.current = false;
      await load();
      if (saved.dry_run === true) paused.current = true;
    } catch (err) {
      const coded = err as Error & { code?: string };
      if (coded.code === "LARGE_QTY") setAdjustPreview({ ...(adjustPreview ?? {}), large: true, needs_confirm: true });
      setError(coded.message || "Could not save the adjustment.");
    } finally {
      setBusy(false);
    }
  }

  async function undo(batchId: string) {
    setError("");
    setBusy(true);
    paused.current = true;
    try {
      const saved = await post("/api/pos/kitchen/undo", { batch_id: batchId, confirm: true });
      paused.current = false;
      await load();
      if (saved.dry_run === true) {
        paused.current = true;
        setError(`Dry run. Undo of ${batchId} would reverse ${Array.isArray(saved.lines) ? saved.lines.length : 0} lines and write nothing.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className={styles.pin}>Loading kitchen…</main>;

  if (!stock) {
    return (
      <main className={styles.pin}>
        <form className={styles.card} onSubmit={(event) => { event.preventDefault(); void signIn(); }}>
          <h1>PNY1 Kitchen</h1>
          <p>Back of house. This PIN cannot ring sales.</p>
          <div className={styles.dots} data-testid="kitchen-pin">{pin.replace(/./g, "•") || " "}</div>
          <div className={styles.keys}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"].map((key) => (
              <button key={key} type="button" className={key === "Clear" || key === "⌫" ? styles.ghost : undefined} onClick={() => {
                if (key === "Clear") setPin("");
                else if (key === "⌫") setPin((value) => value.slice(0, -1));
                else if (pin.length < 4) setPin((value) => value + key);
              }}>{key}</button>
            ))}
          </div>
          {error ? <p className={styles.warn}>{error}</p> : null}
          <button type="submit" disabled={busy || pin.length !== 4}>Sign in</button>
        </form>
      </main>
    );
  }

  const refillLines = (Array.isArray(refillPreview?.lines) ? refillPreview.lines : []) as DiffLine[];
  const unknown = (Array.isArray(refillPreview?.unknown) ? refillPreview.unknown : []) as DiffLine[];

  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <div className={styles.brand}>PNY1 Kitchen</div>
        <div>Updated {stock.updated_at_toronto} Toronto · read {stock.read_at_toronto}</div>
        <button className={styles.ghost} type="button" onClick={() => void fetch("/api/pos/kitchen/logout", { method: "POST" }).then(() => setStock(null))}>Sign out</button>
      </header>
      <div className={stock.writes ? `${styles.banner} ${styles.live}` : styles.banner} data-testid="kitchen-mode">
        {stock.writes ? "Writes are on. Confirm saves stock." : "Dry run. The shelf you see is live. Refill and adjust show what would be written and save nothing."}
        {stock.no_weed ? " NO WEED shift: THC is hidden on the till and still listed here." : ""}
        {stock.shift_open ? "" : " No open shift, so a refill cannot be received."}
      </div>
      <div className={`${styles.tools} ${styles.noPrint}`}>
        <input className={styles.grow} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU or name" aria-label="Search stock" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className={styles.ghost} type="button" onClick={exportCsv}>Export CSV</button>
        <button className={styles.ghost} type="button" onClick={() => window.print()}>Print count sheet</button>
      </div>
      <div className={styles.totals}>
        <span>{visible.length} SKUs</span>
        <span>{visibleUnits} units</span>
        <span>{formatMoney(visibleRetail)} retail</span>
      </div>
      <div className={`${styles.tableWrap} ${styles.noPrint}`}>
        <table>
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>Size</th><th>Category</th><th>Price</th><th>On hand</th><th>THC</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.sku} className={row.on_hand === 0 ? styles.zero : undefined} data-testid={`sku-${row.sku}`}>
                <td>{row.sku}</td>
                <td>{row.name}</td>
                <td>{row.size}</td>
                <td>{row.category}</td>
                <td>{formatMoney(row.price_cents)}</td>
                <td>{row.on_hand}</td>
                <td className={row.thc ? styles.thc : undefined}>{row.thc ? "Y" : "N"}{stock.no_weed && row.thc ? " hidden on till" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className={styles.printOnly}>
        <h1>PNY1 kitchen count</h1>
        <p>{stock.read_at_toronto} Toronto</p>
        <table>
          <thead>
            <tr><th>SKU</th><th>Name</th><th>Size</th><th>On hand</th><th>Counted</th></tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.sku}><td>{row.sku}</td><td>{row.name}</td><td>{row.size}</td><td>{row.on_hand}</td><td></td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={`${styles.panel} ${styles.noPrint}`}>
        <h2>Upload a refill</h2>
        <p>SKU, size, qty. One line each, or a CSV. It uses the same received refill as the till.</p>
        <textarea rows={5} value={refillText} onChange={(event) => { setRefillText(event.target.value); setRefillPreview(null); }} placeholder={"170, 3g, 2\n1001, 4"} aria-label="Refill lines" />
        <div className={styles.actions}>
          <label className={styles.file}>
            CSV
            <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => { setRefillText(text); setRefillPreview(null); });
            }} />
          </label>
          <button type="button" disabled={busy || !refillText.trim()} onClick={() => void previewRefill()}>Preview</button>
          <button type="button" disabled={busy || !refillPreview || Boolean(refillPreview.duplicate) || unknown.length > 0} onClick={() => void confirmRefill()}>Confirm</button>
        </div>
        {typeof refillPreview?.warning === "string" && refillPreview.warning ? <p className={styles.warn}>{refillPreview.warning}</p> : null}
        {refillLines.length ? (
          <table className={styles.diff}>
            <thead><tr><th>SKU</th><th>Size</th><th>Now</th><th>Add</th><th>After</th></tr></thead>
            <tbody>
              {refillLines.map((line) => (
                <tr key={line.sku}><td>{line.sku}</td><td>{line.size}</td><td>{line.before}</td><td>+{line.qty}</td><td>{line.after}</td></tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {unknown.length ? <p className={styles.warn}>Unknown SKUs: {unknown.map((line) => line.sku).join(", ")}</p> : null}
        {refillPreview?.dry_run === true ? <p className={styles.warn}>Dry run. Nothing was written.</p> : null}
      </section>
      <section className={`${styles.panel} ${styles.noPrint}`}>
        <h2>Stock control</h2>
        <div className={styles.actions}>
          <input value={adjustSku} onChange={(event) => setAdjustSku(event.target.value)} placeholder="SKU" aria-label="Adjust SKU" />
          <input value={adjustDelta} onChange={(event) => setAdjustDelta(event.target.value)} placeholder="+/- qty" inputMode="numeric" aria-label="Adjust quantity" />
          <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason">
            <option value="damaged">damaged</option>
            <option value="recount">recount</option>
            <option value="correction">correction</option>
            <option value="other">other</option>
          </select>
          <input className={styles.grow} value={note} onChange={(event) => setNote(event.target.value)} placeholder={reason === "other" ? "Note required" : "Note"} aria-label="Adjustment note" />
          <button type="button" disabled={busy} onClick={() => void previewAdjust()}>Preview</button>
          <button type="button" disabled={busy || !adjustPreview} onClick={() => void confirmAdjust(Boolean(adjustPreview?.large))}>Confirm</button>
        </div>
        {adjustPreview ? (
          <p>
            {String(adjustPreview.sku)} {String(adjustPreview.before)} → {String(adjustPreview.after)}
            {adjustPreview.large ? " Large change. Confirm only if this number is right." : ""}
            {typeof adjustPreview.warning === "string" && adjustPreview.warning ? ` ${adjustPreview.warning}` : ""}
            {adjustPreview.dry_run === true ? " Dry run. Nothing was written." : ""}
          </p>
        ) : null}
      </section>
      <section className={`${styles.panel} ${styles.noPrint}`}>
        <h2>Recent batches</h2>
        {stock.batches.length === 0 ? <p>No kitchen batches yet.</p> : null}
        {stock.batches.map((batch) => (
          <div key={batch.batch_id ?? batch.at_toronto} className={styles.actions}>
            <span>{batch.at_toronto} · {batch.action === "KITCHEN_REFILL" ? "Refill" : "Adjust"} · {batch.lines.map((line) => `${line.sku} ${Number(line.qty) > 0 ? "+" : ""}${line.qty}`).join(", ")}</span>
            <button className={styles.ghost} type="button" disabled={busy || !batch.batch_id} onClick={() => batch.batch_id && void undo(batch.batch_id)}>Undo</button>
          </div>
        ))}
      </section>
      {error ? <p className={`${styles.warn} ${styles.noPrint}`}>{error}</p> : null}
    </main>
  );
}
