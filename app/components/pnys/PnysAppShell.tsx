import Link from "next/link";
import styles from "./PnysAppShell.module.css";

export default function PnysAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell} data-pnys-shell>
      <header className={styles.top}>
        <div><strong>PNYS</strong><span> · Staff</span></div>
        <div className={styles.title}>POS foundation</div>
        <strong className={styles.test}>TEST STORE</strong>
      </header>
      <div className={styles.middle}>{children}</div>
      <nav className={styles.bottom} aria-label="PNYS actions">
        <button type="button" disabled>Back</button>
        <Link href="/pos">Till</Link>
        <Link href="/menu">Menu</Link>
        <button type="button" disabled>Next</button>
      </nav>
    </div>
  );
}
