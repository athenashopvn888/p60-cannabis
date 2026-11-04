import { isCigaretteCategory } from "../siteConfig.ts";
import { bagLabel, isFlowerCategory, parseFlowerSku } from "./flowerSku.ts";
import { cigarettePackCents } from "./sizePrice.ts";

export const VERIFY_WINDOW_MS = 2 * 60 * 60 * 1000;

export type CountMeta = { sku: string; name: string; category: string; bag: string };

/** Flowers by bag weight, then lowest tier to highest. Then cigarettes, add-ons, edibles, vapes, concentrates, then the rest. */
export function compareCount(a: CountMeta, b: CountMeta) {
  const flowerA = isFlower(a);
  const flowerB = isFlower(b);
  if (flowerA !== flowerB) return flowerA ? -1 : 1;
  if (flowerA) {
    const weight = weightRank(a.bag) - weightRank(b.bag);
    if (weight) return weight;
    const tier = tierRank(a.category) - tierRank(b.category);
    if (tier) return tier;
  } else {
    const group = groupRank(a.category) - groupRank(b.category);
    if (group) return group;
    if (groupRank(a.category) === 5) {
      const name = a.category.localeCompare(b.category, "en", { sensitivity: "base" });
      if (name) return name;
    }
  }
  return a.sku.localeCompare(b.sku, "en", { numeric: true });
}

function isFlower(meta: CountMeta) {
  return Boolean(parseFlowerSku(meta.sku)) || isFlowerCategory(meta.category);
}

function weightRank(bag: string) {
  const size = bag.trim().toLowerCase();
  if (size === "3g") return 0;
  if (size === "6g" || size === "5g") return 1;
  if (size === "14g") return 2;
  if (size === "28g") return 3;
  return 4;
}

function tierRank(category: string) {
  const key = category.trim().toLowerCase();
  const order = ["budget", "aa", "aaa+", "premium", "exotic"];
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
}

function groupRank(category: string) {
  const key = category.trim().toLowerCase();
  if (key === "cigarettes" || key === "cigarette" || key === "tobacco") return 0;
  if (key === "add ons" || key === "addons" || key === "add on") return 1;
  if (key === "edibles" || key === "edible") return 2;
  if (key.includes("vape")) return 3;
  if (key === "concentrates" || key === "concentrate") return 4;
  return 5;
}

/** POS strain number. `350-5g` shows as 350. A pack SKU stays whole. */
export function displaySku(sku: string) {
  return parseFlowerSku(sku)?.base ?? sku.trim();
}

/** Size chip the till already shows. 300/400/500-series 5g bags are 6g. Packs stay "pack". */
export function sizeLabel(sku: string, category?: string | null, name?: string | null) {
  const bag = bagLabel(sku);
  if (bag) return bag;
  if (cigarettePackCents(sku, category, name) != null || isCigaretteCategory(category)) return "pack";
  return "each";
}

/** Left side of a discrepancy row. `#200 5g` — no dash after the SKU. */
export function staffSkuText(sku: string, size: string) {
  return `#${displaySku(sku)} ${size}`;
}

/** Right side. Short is `-2`, over is `+1`, exact is `0`. No brackets. */
export function signedOff(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function arrangeOff<T extends { sku: string; off: number }>(lines: T[], order: string[]) {
  const rank = new Map(order.map((sku, index) => [sku, index]));
  const byOrder = (a: T, b: T) => (rank.get(a.sku) ?? 0) - (rank.get(b.sku) ?? 0);
  return [...lines.filter((line) => line.off !== 0).sort(byOrder), ...lines.filter((line) => line.off === 0).sort(byOrder)];
}
