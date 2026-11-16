"use client";

import { useState } from "react";
import styles from "./till.module.css";

export default function WeedToggle({ current, busy, cartHasItems = false, error = "", onOpen, onConfirm }: {
  current: boolean;
  busy: boolean;
  cartHasItems?: boolean;
  error?: string;
  onOpen?: () => void;
  onConfirm: (next: boolean) => void | boolean | Promise<void | boolean>;
}) {
  const [target, setTarget] = useState<boolean | null>(null);

  function open() {
    onOpen?.();
    setTarget(!current);
  }

  async function save() {
    if (target == null) return;
    const saved = await onConfirm(target);
    if (saved !== false) setTarget(null);
  }

  return (
    <>
      <button
        className={`${styles.cornerBtn} ${current ? styles.weedToggleOn : styles.weedToggleOff}`}
        type="button"
        data-testid="weed-toggle"
        aria-pressed={current}
        disabled={busy}
        onClick={open}
      >
        {current ? "WEED ON" : "WEED OFF"}
      </button>
      {target != null ? (
        <div className={styles.ruleScrim} role="dialog" aria-modal="true" aria-labelledby="weed-toggle-title" data-testid="weed-toggle-confirm">
          <section className={styles.ruleSheet}>
            <h2 id="weed-toggle-title">Turn WEED {target ? "ON" : "OFF"}?</h2>
            <p>
              {target
                ? "THC SKUs will show again with their saved quantities."
                : "THC SKUs will be hidden. Their saved quantities will not be changed."}
            </p>
            {cartHasItems ? <p><strong>The current cart will be cleared.</strong></p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.askActions}>
              <button className={styles.secondary} type="button" disabled={busy} onClick={() => setTarget(null)}>Cancel</button>
              <button className={styles.primary} type="button" disabled={busy} data-testid="weed-toggle-save" onClick={() => void save()}>
                Confirm WEED {target ? "ON" : "OFF"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
