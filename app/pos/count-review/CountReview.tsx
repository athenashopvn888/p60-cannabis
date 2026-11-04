"use client";

import { useState } from "react";
import AdminGaps from "../AdminGaps";
import styles from "../till.module.css";

type Row = {
  sku: string;
  text: string;
  off: number;
  counted: number | null;
  expected: number;
  added_stock?: boolean;
  accepted_as_is?: boolean;
};

export default function CountReview() {
  const [password, setPassword] = useState("");
  const [opening, setOpening] = useState<Row[] | null>(null);
  const [closing, setClosing] = useState<Row[]>([]);
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    const login = await fetch("/api/pos/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    if (!login.ok) {
      setError("Admin sign-in is required.");
      return;
    }
    const review = await fetch("/api/pos/admin/counts", { cache: "no-store", credentials: "same-origin" });
    const data = await review.json();
    if (!review.ok) {
      setError(data.error || "Admin sign-in is required.");
      return;
    }
    setOpening((data.opening ?? []).filter((row: Row) => row.counted != null));
    setClosing((data.closing ?? []).filter((row: Row) => row.counted != null));
  }

  if (!opening) {
    return (
      <main className={styles.shell}>
        <section className={styles.pin}>
          <h1 className={styles.brand}>Admin count</h1>
          <p>Staff do not see counted or expected quantities. This screen is admin only.</p>
          <input className={styles.field} type="password" aria-label="Admin password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.primary} type="button" onClick={() => void signIn()}>Open</button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="admin-count-review">
      <header className={styles.header}>
        <div className={styles.brand}>Admin count</div>
      </header>
      <AdminGaps rows={opening} />
      {closing.length > 0 ? (
        <section className={styles.gapPanel}>
          <h2>Closing</h2>
          <AdminGaps rows={closing} title="Closing count" />
        </section>
      ) : null}
    </main>
  );
}
