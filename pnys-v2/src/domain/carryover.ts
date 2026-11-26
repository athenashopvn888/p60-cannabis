import { sha256 } from "./stable";

export type CatalogRow = { sku: string; name: string; size: string; tier: string; thc: boolean; priceCents: number };
export type StockRow = { sku: string; quantity: number };

function sorted<T extends { sku: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function catalogReconciliation(source: CatalogRow[], target: CatalogRow[]) {
  const left = sorted(source);
  const right = sorted(target);
  const sourceChecksum = sha256(left);
  const targetChecksum = sha256(right);
  return { sourceCount: left.length, targetCount: right.length, sourceChecksum, targetChecksum, matches: sourceChecksum === targetChecksum };
}

export function stockReconciliation(source: StockRow[], target: StockRow[]) {
  const left = sorted(source);
  const right = sorted(target);
  const sourceChecksum = sha256(left);
  const targetChecksum = sha256(right);
  return {
    sourceCount: left.length,
    targetCount: right.length,
    sourceUnits: left.reduce((sum, row) => sum + row.quantity, 0),
    targetUnits: right.reduce((sum, row) => sum + row.quantity, 0),
    sourceChecksum,
    targetChecksum,
    matches: sourceChecksum === targetChecksum,
  };
}
