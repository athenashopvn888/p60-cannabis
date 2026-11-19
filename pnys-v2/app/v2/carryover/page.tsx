import { catalogReconciliation, stockReconciliation } from "@/src/domain/carryover";

const catalog = [
  { sku: "172-3g", name: "Lavender Kush", size: "3g", tier: "Premium", thc: true, priceCents: 2000 },
  { sku: "396-3g", name: "Khalifa Kush", size: "3g", tier: "Budget", thc: true, priceCents: 2000 },
];
const stock = [{ sku: "172-3g", quantity: 7 }, { sku: "396-3g", quantity: 20 }];

export default function CarryoverPage() {
  const catalogCheck = catalogReconciliation(catalog, catalog);
  const stockCheck = stockReconciliation(stock, stock);
  return (
    <div className="stack">
      <section className="card">
        <div className="eyebrow">Dry-run contract · no PNYS reads</div>
        <h1>Clean carryover proof</h1>
        <p className="notice warning">This preview uses ACD01 v2 fixtures only. A real PNYS comparison is allowed only during the approved switch rehearsal and remains read-only until OK SWITCH.</p>
      </section>
      <section className="grid grid2">
        <div className="card"><h2>Catalog + prices</h2><p>{catalogCheck.sourceCount} → {catalogCheck.targetCount} rows</p><p className="over">CHECKSUM MATCH</p><code>{catalogCheck.sourceChecksum.slice(0, 20)}…</code></div>
        <div className="card"><h2>Stock on hand</h2><p>{stockCheck.sourceUnits} → {stockCheck.targetUnits} units</p><p className="over">CHECKSUM MATCH</p><code>{stockCheck.sourceChecksum.slice(0, 20)}…</code></div>
      </section>
      <section className="card"><h2>Only four migration lanes</h2><ol><li>Staff identities + PIN hashes, encrypted in transit and never rendered.</li><li>Fresh counted stock with per-SKU reconciliation.</li><li>Catalog, prices, sizes, tiers and THC labels.</li><li>Historical shifts, sales, refills, closes and audit imported immutable.</li></ol></section>
    </div>
  );
}
