"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatMoney } from "../../lib/pny-pos/money";
import styles from "../till.module.css";

type Admin = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  sheet_configured?: boolean;
  sheet_sync_delayed?: boolean;
  sheet_alert?: boolean;
  sccx_not_acked?: boolean;
  shifts?: { id: string; sccx_shift_id: string; status: string; end_reason: string | null; pin_failed_attempts: number }[];
  products?: { sku: string; name: string; enabled: boolean; price_cents: number; qty: number; setb_active: boolean }[];
  sales?: { id: string; ref_no: string; total_cents: number; status: string }[];
  closings?: { shift_id: string; late: boolean; acked: boolean; no_count: boolean; summary_text: string }[];
  outbox?: { row_id: string; tab: string; status: string; attempts: number; last_error: string | null }[];
  alerts?: { action: string; detail: Record<string, unknown>; created_at: string }[];
  reconciliation?: { ok: boolean };
  error?: string;
};

export default function AdminApp() {
  const [state, setState] = useState<Admin | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/state", { cache: "no-store" });
    if (response.status === 403) {
      setState({ authenticated: false });
      return;
    }
    const data = (await response.json()) as Admin;
    setState({ ...data, authenticated: response.ok });
  }, []);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const response = await fetch("/api/admin/state", { cache: "no-store" });
      if (stop) return;
      if (response.status === 403) {
        setState({ authenticated: false });
        return;
      }
      const data = (await response.json()) as Admin;
      if (!stop) setState({ ...data, authenticated: response.ok });
    })();
    return () => {
      stop = true;
    };
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Request failed");
      return;
    }
    if (data.pin) setPin(String(data.pin));
    setMessage("Saved");
    await load();
  }

  if (!state) return <main className={styles.shell}>Loading admin…</main>;

  if (!state.authenticated) {
    return (
      <main className={styles.shell}>
        <form className={styles.pin} onSubmit={(event) => void login(event)}>
          <h1>PNY01 till admin</h1>
          <p>Demo password, when the local seed is on: demo-admin-secret</p>
          <input className={styles.field} type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Admin password" />
          {message ? <p className={styles.error}>{message}</p> : null}
          <button className={styles.primary} type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.body}>
        {state.demo ? <div className={styles.demo}>{state.demo_label}</div> : null}
        {state.sccx_not_acked ? <div className={styles.banner}>SCCx not acked</div> : null}
        {state.sheet_alert ? <div className={styles.banner}>Sheet sync has been delayed more than 30 minutes.</div> : null}
        <div className={styles.pad}>
          <h1>PNY01 admin</h1>
          <p>Sheet {state.sheet_configured ? "configured" : "not configured — local outbox only"}. Reconciliation {state.reconciliation?.ok ? "passes" : "needs a look"}.</p>
          {message ? <p>{message}</p> : null}
          {pin ? <p>New PIN: {pin}</p> : null}
        </div>
        <section className={styles.pad}>
          <h2>Shifts</h2>
          {(state.shifts ?? []).map((shift) => (
            <p key={shift.id}>
              {shift.sccx_shift_id} · {shift.status} {shift.end_reason ?? ""} · fails {shift.pin_failed_attempts}
              {shift.status !== "ENDED" ? (
                <>
                  <button type="button" onClick={() => void act("/api/admin/reissue-pin", { shift_id: shift.id })}>Reissue PIN</button>
                  <button type="button" onClick={() => void act("/api/admin/kill-shift", { shift_id: shift.id })}>Kill</button>
                </>
              ) : null}
            </p>
          ))}
        </section>
        <section className={styles.pad}>
          <h2>SCCx closings</h2>
          {(state.closings ?? []).map((closing) => (
            <p key={closing.shift_id}>{closing.shift_id} · {closing.acked ? "acked" : closing.late ? "SCCx not acked" : "waiting"} {closing.no_count ? "· no count" : ""}</p>
          ))}
        </section>
        <section className={styles.pad}>
          <h2>Voids</h2>
          {(state.sales ?? []).filter((sale) => sale.status === "COMPLETED").slice(0, 8).map((sale) => (
            <p key={sale.id}>{sale.ref_no} · {formatMoney(sale.total_cents)} <button type="button" onClick={() => void act("/api/admin/void", { sale_id: sale.id, reason: "admin void" })}>Void</button></p>
          ))}
        </section>
        <section className={styles.pad}>
          <h2>Stock and price</h2>
          {(state.products ?? []).map((product) => (
            <p key={product.sku}>{product.sku} {product.name} · {formatMoney(product.price_cents)} · qty {product.qty} · {product.enabled ? "enabled" : "disabled"}</p>
          ))}
        </section>
        <section className={styles.pad}>
          <h2>Outbox</h2>
          {(state.outbox ?? []).slice(0, 12).map((row) => (
            <p key={row.row_id}>{row.tab} {row.row_id} · {row.status} · tries {row.attempts} {row.last_error ?? ""}</p>
          ))}
          <h2>Alerts</h2>
          {(state.alerts ?? []).slice(0, 8).map((alert) => (
            <p key={`${alert.action}-${alert.created_at}`}>{alert.action}</p>
          ))}
        </section>
      </div>
    </main>
  );
}
