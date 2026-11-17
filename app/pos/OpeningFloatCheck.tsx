"use client";

import { useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import styles from "./openingFloat.module.css";

function centsOf(value: string) {
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
}

export default function OpeningFloatCheck({
  expectedCents,
  value,
  busy,
  error,
  initialWarning = false,
  onChange,
  onSave,
}: {
  expectedCents: number;
  value: string;
  busy: boolean;
  error?: string;
  initialWarning?: boolean;
  onChange: (value: string) => void;
  onSave: (foundCents: number, confirmAdjustment: boolean) => Promise<void> | void;
}) {
  const [warning, setWarning] = useState(initialWarning);
  const foundCents = centsOf(value);
  const difference = foundCents == null ? null : foundCents - expectedCents;
  const mismatch = difference != null && difference !== 0;

  function submit() {
    if (foundCents == null) return;
    if (mismatch) setWarning(true);
    else void onSave(foundCents, false);
  }

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="float-title" data-testid="float-verify">
      <section className={styles.sheet}>
        <div>
          <p className={styles.eyebrow}>Shift opening</p>
          <h2 id="float-title">Confirm opening cash</h2>
          <p>Count the cash in the drawer and compare it with the previous shift.</p>
        </div>
        <div className={styles.cards}>
          <article data-testid="previous-closing-cash">
            <span>Previous closing cash</span>
            <strong>{formatMoney(expectedCents)}</strong>
            <small>Recorded by the previous shift</small>
          </article>
          <article className={mismatch ? styles.mismatch : difference === 0 ? styles.match : ""} data-testid="current-opening-count">
            <span>Current opening count</span>
            <strong>{foundCents == null ? "—" : formatMoney(foundCents)}</strong>
            <small>{difference == null ? "Enter your count below" : difference === 0 ? "✓ Match" : `${difference > 0 ? "+" : "−"}${formatMoney(Math.abs(difference))} difference`}</small>
          </article>
        </div>
        <label className={styles.fieldLabel}>
          Cash counted now
          <input inputMode="decimal" aria-label="Current opening cash count" data-testid="float-found-input" value={value} onChange={(event) => { onChange(event.target.value); setWarning(false); }} placeholder="0.00" />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={mismatch ? styles.adjust : styles.confirm} type="button" disabled={busy || foundCents == null} onClick={submit} data-testid={mismatch ? "float-adjust" : "float-confirm"}>
          {mismatch ? "Adjust" : "Confirm opening cash"}
        </button>
      </section>
      {warning && mismatch && foundCents != null ? (
        <div className={styles.warningScrim} role="alertdialog" aria-modal="true" aria-labelledby="float-warning-title" data-testid="float-adjust-warning">
          <section className={styles.warning}>
            <div className={styles.warningIcon} aria-hidden="true">⚠️</div>
            <h2 id="float-warning-title">Are you sure?</h2>
            <p>The opening cash differs from the previous shift.</p>
            <dl>
              <div><dt>Previous close</dt><dd>{formatMoney(expectedCents)}</dd></div>
              <div><dt>Counted now</dt><dd>{formatMoney(foundCents)}</dd></div>
              <div><dt>Difference</dt><dd>{difference > 0 ? "+" : "−"}{formatMoney(Math.abs(difference))}</dd></div>
            </dl>
            <p className={styles.auditNote}>This adjustment records the amount, difference, staff and time in the audit log and final till report.</p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setWarning(false)}>Go back</button>
              <button type="button" className={styles.adjust} disabled={busy} onClick={() => void onSave(foundCents, true)}>Yes, record adjustment</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
