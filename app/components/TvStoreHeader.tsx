import { tvStore } from "../lib/tvStore";
import styles from "./TvStoreHeader.module.css";

export default function TvStoreHeader({
  eyebrow,
  stockUpdated,
}: {
  eyebrow: string;
  stockUpdated?: string | null;
}) {
  return (
    <div className={styles.stack}>
      <header className={styles.header}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/storeFavicon.webp" alt="" />
          <div>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1>{tvStore.name}</h1>
          </div>
        </div>
        <div className={styles.meta}>
          {tvStore.shortAddress ? (
            <div>
              <span>Location</span>
              <strong>{tvStore.shortAddress}</strong>
            </div>
          ) : null}
          {tvStore.hours ? (
            <div>
              <span>Open</span>
              <strong>{tvStore.hours}</strong>
            </div>
          ) : null}
          {stockUpdated ? (
            <div className={styles.stock}>
              <span>Stock</span>
              <strong>Stock updated {stockUpdated}</strong>
            </div>
          ) : null}
        </div>
      </header>
      {tvStore.open24Hours7Days ? (
        <div className={styles.hoursAlert}>NEW! NOW OPEN 24 HOURS</div>
      ) : null}
    </div>
  );
}
