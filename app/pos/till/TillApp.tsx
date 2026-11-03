"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "../../lib/pny-pos/money";
import styles from "../till.module.css";

type View = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  demo_pin?: string | null;
  shift?: { staff_name: string };
  totals?: { sales_cents: number; cash_sales_cents?: number; debit_sales_cents?: number; cash_on_hand_cents: number; deposited_cents: number };
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

export default function TillApp() {
  const [view, setView] = useState<View | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [open, setOpen] = useState(false);

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
    const timer = window.setInterval(run, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [load]);

  async function signIn() {
    setError("");
    setBusy(true);
    try {
      await post("/api/pos/login", { pin });
      setPin("");
      await load();
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      setError(err instanceof Error ? (code ? `${err.message} (${code})` : err.message) : "Could not sign in.");
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
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <main className={styles.shell}>Loading till…</main>;

  if (!view.authenticated) {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"];
    return (
      <main className={styles.shell} data-testid="pos-till-login">
        {view.demo ? <div className={styles.demo}>{view.demo_label} · PIN {view.demo_pin}</div> : null}
        <section className={styles.pin}>
          <h1 className={styles.brand}>Staff till</h1>
          <p>Enter the same 4-digit shift PIN. Five wrong tries lock the shift.</p>
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
    <main className={styles.shell} data-testid="pos-till">
      {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link className={styles.backLink} href="/pos">Back</Link>
          <div className={styles.brand}>Till · {view.shift?.staff_name}</div>
        </div>
      </header>
      <section className={styles.tillCards}>
        <article className={styles.tillCard} data-testid="cash-sales">
          <span>Cash sales</span>
          <strong>{formatMoney(view.totals?.cash_sales_cents ?? view.totals?.sales_cents ?? 0)}</strong>
        </article>
        <article className={styles.tillCard} data-testid="debit-sales">
          <span>Debit sales</span>
          <strong>{formatMoney(view.totals?.debit_sales_cents ?? 0)}</strong>
        </article>
        <article className={styles.tillCard} data-testid="total-sales">
          <span>Total</span>
          <strong>{formatMoney(view.totals?.sales_cents ?? 0)}</strong>
        </article>
        <article className={styles.tillCard} data-testid="cash-on-hand">
          <span>Cash on Hand</span>
          <strong>{formatMoney(view.totals?.cash_on_hand_cents ?? 0)}</strong>
        </article>
        <article className={styles.tillCard} data-testid="total-deposited">
          <span>Total Deposited</span>
          <strong>{formatMoney(view.totals?.deposited_cents ?? 0)}</strong>
        </article>
        {open ? (
          <div className={styles.tillCard}>
            <span>+Deposit</span>
            <p>Cash on hand is {formatMoney(view.totals?.cash_on_hand_cents ?? 0)}. A larger deposit is blocked.</p>
            <input className={styles.field} inputMode="decimal" placeholder="0.00" value={deposit} onChange={(event) => setDeposit(event.target.value)} aria-label="Deposit amount" />
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className={styles.primary} type="button" disabled={busy} onClick={() => void sendDeposit()}>Deposit</button>
            </div>
          </div>
        ) : (
          <button className={styles.depositBtn} type="button" onClick={() => { setError(""); setOpen(true); }}>+Deposit</button>
        )}
      </section>
    </main>
  );
}
