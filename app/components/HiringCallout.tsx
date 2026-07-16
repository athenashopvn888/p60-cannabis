import Link from "next/link";
import styles from "./HiringCallout.module.css";

export default function HiringCallout() {
  return (
    <section aria-label="P60 Cannabis hiring" className={styles.section}>
      <div className={styles.callout}>
        <div>
          <span className={styles.eyebrow}>
            Budtenders / Managers Wanted
          </span>
          <h2 className={styles.heading}>
            Join P60 Cannabis
          </h2>
          <p className={styles.copy}>
            Weston Road needs motivated people who learn quickly, stay calm with customers, and keep the counter moving. Online applications only. Please do not call the store about hiring.
          </p>
        </div>
        <Link
          href="/careers/budtender"
          className={styles.apply}
        >
          Apply Online
        </Link>
      </div>
    </section>
  );
}
