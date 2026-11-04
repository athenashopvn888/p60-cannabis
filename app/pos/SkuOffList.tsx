import styles from "./till.module.css";

export type OffLine = { sku: string; text: string; off: number };

/** One SKU per row. Left is `#200 5g`. Right is the signed amount, red when short and green when over. */
export default function SkuOffList({ lines, testId }: { lines: OffLine[]; testId?: string }) {
  return (
    <div className={styles.offList} data-testid={testId}>
      {lines.map((line) => {
        const tone = line.off < 0 ? styles.offShort : line.off > 0 ? styles.offOver : styles.offEven;
        return (
          <div key={line.sku} className={styles.offRow} data-sku={line.sku}>
            <span className={styles.offId}>{line.text}</span>
            <span className={`${styles.offQty} ${tone}`}>{line.off > 0 ? `+${line.off}` : String(line.off)}</span>
          </div>
        );
      })}
    </div>
  );
}
