"use client";

import styles from "./till.module.css";

export default function DepositSlip({ code, onDone }: { code: string; onDone: () => void }) {
  return (
    <section className={styles.depositSlip} data-testid="deposit-slip" role="dialog" aria-modal="true" aria-labelledby="deposit-slip-code">
      <p className={styles.depositSlipLabel}>Deposit #</p>
      <p id="deposit-slip-code" className={styles.depositSlipCode}>{code}</p>
      <p className={styles.depositSlipNote}>Write the full Deposit #, including PNY, on a slip of paper and attach it to the money.</p>
      <button className={styles.primary} type="button" data-testid="deposit-slip-done" onClick={onDone}>Done, slip attached</button>
    </section>
  );
}
