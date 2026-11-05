"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { cashGapCents, cashWordText } from "../../lib/pny-pos/pny01Balance";
import { formatMoney } from "../../lib/pny-pos/money";
import styles from "../till.module.css";
import { usePosPoll } from "../usePosPoll";
import DepositSlip from "../DepositSlip";
import VerifyBanner, { useVerifyOpen } from "../VerifyBanner";

type View = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  demo_pin?: string | null;
  shift?: { staff_name: string };
  master?: boolean;
  totals?: { sales_cents: number; cash_sales_cents?: number; debit_sales_cents?: number; cash_on_hand_cents: number; deposited_cents: number };
  error?: string;
  code?: string;
  verify?: { show_banner?: boolean; deadline_at?: string };
  deposits?: { id: string; deposit_code?: string | null; amount_cents: number; created_at: string }[];
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

export default function TillApp({
  apiBase = "/api/pos",
  homeHref = "/pos",
  cashLabels = false,
}: {
  apiBase?: string;
  homeHref?: string;
  /** PNY01 names extra cash OVER and a short deposit SHORT. PNY02 leaves this off. */
  cashLabels?: boolean;
} = {}) {
  const [view, setView] = useState<View | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [open, setOpen] = useState(false);
  const [slipCode, setSlipCode] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`${apiBase}/state`, { cache: "no-store", credentials: "same-origin" });
    const data = (await response.json()) as View;
    setView(data);
    if (!data.authenticated && data.error) setError(data.code ? `${data.error} (${data.code})` : data.error);
  }, [apiBase]);

  usePosPoll(load);
  const verifyOpen = useVerifyOpen(view?.verify?.show_banner ? view.verify.deadline_at ?? null : null, load);

  async function signIn() {
    setError("");
    setBusy(true);
    try {
      await post(`${apiBase}/login`, { pin });
      setPin("");
      const response = await fetch(`${apiBase}/state`, { cache: "no-store", credentials: "same-origin" });
      const data = (await response.json()) as View;
      setView(data);
      setViewOnly(Boolean(data.master));
      setUnlocked(true);
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      setError(err instanceof Error ? (code ? `${err.message} (${code})` : err.message) : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setError("");
    setBusy(true);
    try {
      const result = await post(`${apiBase}/till/unlock`, { pin });
      setPin("");
      setViewOnly(Boolean(result.view_only));
      setUnlocked(true);
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      setError(err instanceof Error ? (code ? `${err.message} (${code})` : err.message) : "Could not open the till.");
    } finally {
      setBusy(false);
    }
  }

  async function sendDeposit() {
    setError("");
    const cents = Math.round(Number(deposit) * 100);
    setBusy(true);
    try {
      const saved = await post(`${apiBase}/deposits`, { amount_cents: cents }, crypto.randomUUID());
      setDeposit("");
      setOpen(false);
      if (typeof saved.deposit_code === "string") setSlipCode(saved.deposit_code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <main className={styles.shell}>Loading till…</main>;

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"];
  const pinPad = (onDigit: (digit: string) => void) => (
    <div className={styles.keys}>
      {digits.map((digit) => (
        <button key={digit} type="button" onClick={() => onDigit(digit)}>
          {digit}
        </button>
      ))}
    </div>
  );

  if (!view.authenticated) {
    return (
      <main className={styles.shell} data-testid="pos-till-login">
        {view.demo ? <div className={styles.demo}>{view.demo_label} · PIN {view.demo_pin}</div> : null}
        <section className={styles.pin}>
          <h1 className={styles.brand}>Staff till</h1>
          <p>Enter the same 4-digit shift PIN. Five wrong tries lock the shift.</p>
          <div className={styles.pinDisplay} aria-live="polite">{pin.replace(/./g, "•") || " "}</div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {pinPad((digit) => {
            if (digit === "Clear") setPin("");
            else if (digit === "⌫") setPin((current) => current.slice(0, -1));
            else setPin((current) => (current + digit).slice(0, 4));
          })}
          <button className={styles.primary} type="button" disabled={pin.length !== 4 || busy} onClick={() => void signIn()} style={{ width: "100%", marginTop: 12 }}>
            Sign in
          </button>
        </section>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className={styles.shell} data-testid="pos-till-gate">
        {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
        <section className={styles.pin}>
          <h1 className={styles.brand}>Till</h1>
          <p>Enter the shift PIN to open the till. Five wrong tries lock the shift.</p>
          <div className={styles.pinDisplay} aria-live="polite">{pin.replace(/./g, "•") || " "}</div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {pinPad((digit) => {
            if (digit === "Clear") setPin("");
            else if (digit === "⌫") setPin((current) => current.slice(0, -1));
            else setPin((current) => (current + digit).slice(0, 4));
          })}
          <button className={styles.primary} type="button" data-testid="till-unlock" disabled={pin.length !== 4 || busy} onClick={() => void unlock()} style={{ width: "100%", marginTop: 12 }}>
            Open till
          </button>
          <Link className={styles.backLink} href={homeHref === "/pos" ? "/pos" : homeHref} style={{ color: "#1c1917", marginTop: 12 }}>Back to POS</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="pos-till">
      {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
      {verifyOpen && view.verify?.deadline_at ? (
        <VerifyBanner deadline={view.verify.deadline_at} onOpen={() => { window.location.href = homeHref; }} />
      ) : null}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link className={styles.backLink} href={homeHref === "/pos" ? "/pos" : homeHref}>Back</Link>
          <div className={styles.brand}>Till · {view.shift?.staff_name}{viewOnly ? " · Master view" : ""}</div>
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
          <span>{cashLabels ? "Cash" : "Cash on Hand"}</span>
          <strong>{cashLabels ? cashWordText(cashGapCents(view.totals?.cash_sales_cents ?? view.totals?.sales_cents ?? 0, view.totals?.deposited_cents ?? 0)) : formatMoney(view.totals?.cash_on_hand_cents ?? 0)}</strong>
        </article>
        <article className={styles.tillCard} data-testid="total-deposited">
          <span>Total Deposited</span>
          <strong>{formatMoney(view.totals?.deposited_cents ?? 0)}</strong>
          <div className={styles.depositList} data-testid="till-deposits">
            {(view.deposits ?? []).map((row) => (
              <div key={row.id} className={styles.depositLine}>
                <span>{row.deposit_code || "n/a"}</span>
                <strong>{formatMoney(row.amount_cents)}</strong>
              </div>
            ))}
          </div>
        </article>
        {viewOnly ? null : open ? (
          <div className={styles.tillCard}>
            <span>+Deposit</span>
            <p>{cashLabels ? `Cash is ${cashWordText(cashGapCents(view.totals?.cash_sales_cents ?? view.totals?.sales_cents ?? 0, view.totals?.deposited_cents ?? 0))}.` : `Cash on hand is ${formatMoney(view.totals?.cash_on_hand_cents ?? 0)}.`}</p>
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
      {slipCode ? <DepositSlip code={slipCode} onDone={() => setSlipCode(null)} /> : null}
    </main>
  );
}
