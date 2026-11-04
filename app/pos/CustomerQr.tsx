"use client";

import styles from "./till.module.css";
import { CUSTOMER_MENU_URL, customerMenuQr } from "./menuQr";

export default function CustomerQr({ onClose }: { onClose: () => void }) {
  const qr = customerMenuQr();
  return (
    <div className={styles.qrOverlay} data-testid="customer-qr-overlay" role="dialog" aria-modal="true" aria-label="Customer menu QR" onClick={onClose}>
      <button type="button" className={styles.qrClose} aria-label="Close" onClick={onClose}>×</button>
      <svg className={styles.qrCode} viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={CUSTOMER_MENU_URL}>
        <rect width={qr.size} height={qr.size} fill="#ffffff" />
        {qr.data.flatMap((row, y) => row.map((dark, x) => (
          dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000000" /> : null
        )))}
      </svg>
    </div>
  );
}
