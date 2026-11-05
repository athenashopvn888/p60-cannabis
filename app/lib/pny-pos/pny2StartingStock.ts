/** One-time PNY02 opening from the 2026-11-05 06:16 refill sheet. Flower lines are bags of that size. */
export const PNY2_START_NOTE = "PNY2 starting stock from refill sheet 2026-11-05 06:16";
export const PNY2_START_KEY = "pny2-starting-stock-2026-11-05-0616";

export function pny2StartingLines(): { sku: string; qty: number }[] {
  const rows: { sku: string; qty: number }[] = [];
  const flower = (base: string, sizes: Record<string, number>) => {
    for (const [size, qty] of Object.entries(sizes)) rows.push({ sku: `${base}-${size}`, qty });
  };
  flower("172", { "3g": 10, "28g": 1 });
  flower("187", { "3g": 10, "28g": 1 });
  flower("202", { "5g": 10, "14g": 1 });
  flower("203", { "5g": 10, "14g": 1 });
  flower("261", { "5g": 10, "14g": 1 });
  for (const base of ["315", "347", "373", "376"]) flower(base, { "3g": 10, "5g": 10 });
  for (const base of ["418", "425", "426", "427"]) flower(base, { "3g": 2, "5g": 2 });
  for (const base of ["506", "509", "517"]) flower(base, { "3g": 1, "5g": 1 });
  const units: [string, number][] = [
    ["188", 60], ["189", 60], ["240", 30], ["388", 30], ["389", 30], ["488", 10], ["489", 10],
    ["1000", 30], ["1002", 30], ["1005", 30], ["1006", 30], ["1010", 15], ["1012", 15], ["1014", 15], ["1015", 15],
  ];
  for (const [sku, qty] of units) rows.push({ sku, qty });
  return rows;
}
