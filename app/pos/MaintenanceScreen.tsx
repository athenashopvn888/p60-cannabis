import styles from "./maintenance.module.css";

export default function MaintenanceScreen() {
  return <main className={styles.page} data-testid="pnys-maintenance">
    <section>
      <span>PNYS · TEST STORE</span>
      <h1>TEMPORARILY PAUSED</h1>
      <strong>DO NOT TRADE</strong>
      <p>This build is for a controlled maintenance window. Sales, shifts, counts, refills and integration delivery are disabled.</p>
    </section>
  </main>;
}
