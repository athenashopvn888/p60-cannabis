import { formatMoney } from "../lib/pny-pos/money.ts";

function isCigCategory(category: string | undefined) {
  const key = category?.trim().toLowerCase() ?? "";
  return key === "cigarettes" || key === "cigarette" || key === "tobacco" || key === "cigs";
}

/** Customer menu label only. The charged price stays the unit price. */
export function menuPriceText(item: { category?: string; price_cents: number }) {
  if (isCigCategory(item.category) && item.price_cents === 250) return "2 for $5";
  return formatMoney(item.price_cents);
}
