import styles from "./preview.module.css";
import { notFound } from "next/navigation";

export default function CustomerPreviewPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <main className={styles.shell} data-testid="customer-checkout-preview">
    <div className={styles.test}>TEST STORE</div>
    <header className={styles.header}><strong>PNYS · Demo Staff</strong><strong>Customer checkout</strong></header>
    <section className={styles.middle}>
      <h1>Cashout $70.00</h1>
      <p>Customer details are optional and visible only after staff sign-in.</p>
      <label>Customer phone (optional)</label><div className={styles.row}><input value="416 555 0124" readOnly/><button type="button">Find</button></div>
      <p className={styles.match}>Sample Customer · •••• 0124</p>
      <label>Name</label><input value="Sample Customer" readOnly/>
      <label>Email (optional)</label><input value="sample@example.com" readOnly/>
      <label>CASL consent</label><select value="EXPRESS" disabled><option value="EXPRESS">Express</option></select>
      <small>Recorded today · IN_STORE · Nothing is auto-sent.</small>
      <label>Coupon code</label><div className={styles.row}><input value="WELCOME10" readOnly/><button type="button">Apply</button></div>
      <article><strong>$10 welcome coupon</strong><span>−$10.00</span><b>New total $60.00</b></article>
    </section>
    <footer className={styles.footer}><button type="button">Back</button><button type="button">Cash $60</button><button type="button">Debit $60</button></footer>
  </main>;
}
