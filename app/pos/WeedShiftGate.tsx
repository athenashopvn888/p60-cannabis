"use client";

import styles from "./till.module.css";

export default function WeedShiftGate({ staffName, busy, error, onAnswer }: {
  staffName: string;
  busy: boolean;
  error: string;
  onAnswer: (answer: boolean) => void;
}) {
  return (
    <main className={styles.weedGate} role="dialog" aria-modal="true" aria-labelledby="weed-gate-title" data-testid="weed-shift-gate">
      <section className={styles.weedGateCard}>
        <div className={styles.weedGateStore}>PNY01 · {staffName}</div>
        <h1 id="weed-gate-title">WEED in store this shift?</h1>
        <p>Choose one before the opening stock count. You can change it later from the top navigation.</p>
        <div className={styles.weedGateActions}>
          <button className={styles.weedYes} type="button" disabled={busy} onClick={() => onAnswer(true)}>YES</button>
          <button className={styles.weedNo} type="button" disabled={busy} onClick={() => onAnswer(false)}>NO</button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}
