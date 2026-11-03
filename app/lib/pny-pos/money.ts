import { STORE_TZ } from "./constants.ts";

export function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100).toLocaleString("en-CA");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

export function centsToSheet(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatStoreTime(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function inStockCategories(rows: { category: string; qty: number }[]) {
  return [...new Set(rows.filter((row) => row.qty > 0).map((row) => row.category))].sort((a, b) => a.localeCompare(b));
}
