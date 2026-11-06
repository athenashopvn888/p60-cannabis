"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "../../lib/pny-pos/money";
import SkuOffList, { type OffLine } from "../SkuOffList";
import styles from "../till.module.css";

type ShiftRow = {
  id: string;
  status: string;
  staff_name: string;
  date_toronto: string;
  open_toronto: string;
  close_toronto: string | null;
  close_label: string | null;
  has_closing: boolean;
};

type Detail = {
  shift: ShiftRow & {
    sccx_shift_id: string;
    started_at: string;
    ended_at: string | null;
    end_reason: string | null;
    no_count: boolean;
  };
  sales: {
    id: string;
    ref_no: string;
    status: string;
    payment: string;
    total_cents: number;
    created_toronto: string;
    lines: { sku: string; name: string; qty: number; line_total_cents: number }[];
  }[];
  money: {
    stock_gone_cents: number;
    deposits_total_cents: number;
    deposits: { id: string; deposit_code: string | null; amount_cents: number; created_toronto: string }[];
    coh_cents: number;
    final_balance_cents: number;
    final_balance_word: "OVER" | "SHORT" | "EVEN";
    final_balance_label: string;
  };
  variances: {
    opening_verify: { count: number; lines: OffLine[] };
    closing_count: { count: number; lines: OffLine[] };
    refill_issues: {
      count: number;
      lines: { sku: string; text: string; sent: number; received: number; diff: number }[];
    };
  };
  totals: {
    sales_cents: number;
    cash_sales_cents: number;
    debit_sales_cents: number;
    sale_count: number;
    void_count: number;
  };
};

export default function OwnerApp() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shifts, setShifts] = useState<ShiftRow[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const loadShifts = useCallback(async () => {
    const res = await fetch("/api/pos/owner/shifts", { cache: "no-store", credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        setAuthed(false);
        setShifts(null);
        setDetail(null);
        return;
      }
      throw new Error(data.error || "Could not load shifts.");
    }
    setAuthed(true);
    setShifts(data.shifts ?? []);
  }, []);

  useEffect(() => {
    void loadShifts().catch(() => undefined);
  }, [loadShifts]);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const login = await fetch("/api/pos/owner/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const data = await login.json();
      if (!login.ok) {
        setError(data.error || "Sign-in failed.");
        return;
      }
      setPassword("");
      await loadShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openShift(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/pos/owner/shifts/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open shift.");
      setDetail(data as Detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open shift.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/pos/owner/logout", { method: "POST", credentials: "same-origin" });
    setAuthed(false);
    setShifts(null);
    setDetail(null);
  }

  if (!authed) {
    return (
      <main className={styles.shell} data-testid="owner-login">
        <section className={styles.pin}>
          <h1 className={styles.brand}>PNY01 owner</h1>
          <p>Read-only records. Live till is not changed.</p>
          <input
            className={styles.field}
            type="password"
            aria-label="Owner password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void signIn();
            }}
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.primary} type="button" disabled={busy} onClick={() => void signIn()}>
            Open
          </button>
        </section>
      </main>
    );
  }

  if (detail) {
    const money = detail.money;
    const balanceTone =
      money.final_balance_word === "OVER"
        ? styles.offOver
        : money.final_balance_word === "SHORT"
          ? styles.offShort
          : styles.offEven;
    return (
      <main className={styles.shell} data-testid="owner-shift-detail">
        <header className={styles.header}>
          <div className={styles.brand}>
            {detail.shift.date_toronto} · {detail.shift.staff_name}
          </div>
          <div className={styles.actions}>
            <button className={styles.secondary} type="button" onClick={() => setDetail(null)}>
              Back
            </button>
            <button className={styles.secondary} type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </header>
        {error ? <p className={styles.error}>{error}</p> : null}
        <p>
          Open {detail.shift.open_toronto}
          {detail.shift.close_toronto ? ` · Close ${detail.shift.close_toronto}` : " · Open now"} · {detail.shift.status}
          {detail.shift.close_label ? ` · ${detail.shift.close_label}` : ""}
        </p>

        <section className={styles.tillCards} data-testid="owner-money">
          <article className={styles.tillCard}>
            <span>STOCK GONE</span>
            <strong>{formatMoney(money.stock_gone_cents)}</strong>
          </article>
          <article className={styles.tillCard}>
            <span>DEPOSITS</span>
            <strong>{formatMoney(money.deposits_total_cents)}</strong>
            <div className={styles.depositList}>
              {money.deposits.length === 0 ? <div className={styles.depositLine}>None</div> : null}
              {money.deposits.map((row) => (
                <div key={row.id} className={styles.depositLine}>
                  <span>
                    {row.deposit_code || "n/a"} · {row.created_toronto}
                  </span>
                  <strong>{formatMoney(row.amount_cents)}</strong>
                </div>
              ))}
            </div>
          </article>
          <article className={styles.tillCard}>
            <span>COH</span>
            <strong>{formatMoney(money.coh_cents)}</strong>
          </article>
          <article className={styles.tillCard} data-testid="owner-final-balance">
            <span>FINAL BALANCE</span>
            <strong className={balanceTone}>{money.final_balance_label}</strong>
          </article>
        </section>

        <section className={styles.stockBlue} data-testid="owner-opening-verify">
          <h3>Opening verify</h3>
          <p>
            {detail.variances.opening_verify.count === 0
              ? "All matched"
              : `${detail.variances.opening_verify.count} SKUs off`}
          </p>
          <SkuOffList lines={detail.variances.opening_verify.lines} />
        </section>
        <section className={styles.stockRose} data-testid="owner-refill-issues">
          <h3>Refill issues</h3>
          <p>
            {detail.variances.refill_issues.count === 0
              ? "All matched"
              : `${detail.variances.refill_issues.count} refill issues`}
          </p>
          {detail.variances.refill_issues.lines.map((line) => (
            <div key={line.sku} className={styles.refillIssue}>
              <div className={styles.offRow}>
                <strong>{line.text}</strong>
                <strong className={line.diff < 0 ? styles.offShort : line.diff > 0 ? styles.offOver : styles.offEven}>
                  {line.diff > 0 ? `+${line.diff}` : String(line.diff)}
                </strong>
              </div>
              <p className={styles.refillMeta}>
                sent {line.sent} · received {line.received}
              </p>
            </div>
          ))}
        </section>
        <section className={styles.stockAmber} data-testid="owner-closing-count">
          <h3>Closing count</h3>
          <p>
            {detail.variances.closing_count.count === 0
              ? "All matched"
              : `${detail.variances.closing_count.count} SKUs off`}
          </p>
          <SkuOffList lines={detail.variances.closing_count.lines} />
        </section>

        <section className={styles.gapPanel} data-testid="owner-sales">
          <h2>
            Sales ({detail.totals.sale_count}) · Cash {formatMoney(detail.totals.cash_sales_cents)} · Debit{" "}
            {formatMoney(detail.totals.debit_sales_cents)} · Voids {detail.totals.void_count}
          </h2>
          {detail.sales.map((sale) => (
            <div key={sale.id} className={styles.depositLine}>
              <span>
                {sale.created_toronto} · {sale.ref_no} · {sale.payment} · {sale.status}
              </span>
              <strong>{formatMoney(sale.total_cents)}</strong>
            </div>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="owner-shift-list">
      <header className={styles.header}>
        <div className={styles.brand}>PNY01 owner records</div>
        <button className={styles.secondary} type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      {error ? <p className={styles.error}>{error}</p> : null}
      <section className={styles.gapPanel}>
        {(shifts ?? []).length === 0 ? <p>No shifts yet.</p> : null}
        {(shifts ?? []).map((shift) => (
          <button
            key={shift.id}
            className={styles.secondary}
            type="button"
            style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }}
            disabled={busy}
            onClick={() => void openShift(shift.id)}
          >
            <strong>
              {shift.date_toronto} · {shift.staff_name}
            </strong>
            <div>
              {shift.open_toronto}
              {shift.close_toronto ? `–${shift.close_toronto}` : " · open"} · {shift.status}
              {shift.close_label ? ` · ${shift.close_label}` : ""}
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
