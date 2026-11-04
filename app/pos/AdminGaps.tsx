import SkuOffList, { type OffLine } from "./SkuOffList";
import styles from "./till.module.css";

type AdminRow = OffLine & {
  counted: number | null;
  expected: number;
  added_stock?: boolean;
  accepted_as_is?: boolean;
};

export default function AdminGaps({ rows }: { rows: AdminRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className={styles.gapPanel} data-testid="admin-gaps">
      <h2>Admin count</h2>
      {rows.map((row) => (
        <div key={row.sku}>
          <SkuOffList lines={[row]} />
          <p className={styles.adminDetail}>
            counted {row.counted ?? "—"} · book {row.expected}
            {row.added_stock ? " · Added stock" : ""}
            {row.accepted_as_is ? " · Accepted as-is" : ""}
          </p>
        </div>
      ))}
    </section>
  );
}
