import Image from "next/image";

import reviewQr from "./store-review-qr.png";
import styles from "./TvReviewQr.module.css";

export default function TvReviewQr({ storeName }: Readonly<{ storeName: string }>) {
  return (
    <aside className={styles.card} aria-label={`Review ${storeName} on Google`}>
      <Image className={styles.image} src={reviewQr} alt={`QR code to review ${storeName} on Google`} sizes="8vw" priority />
      <span className={styles.note}>SCAN FOR REVIEW</span>
    </aside>
  );
}
