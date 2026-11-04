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

/** Chip order for the customer menu and the till. Anything else follows, A to Z. */
const CATEGORY_ORDER = ["exotic", "premium", "aaa+", "aa", "budget", "add ons", "cigarettes", "edibles", "concentrates"];

function categoryKey(name: string) {
  return name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function categoryRank(name: string) {
  const key = categoryKey(name);
  const tobacco = key === "cigarette" || key === "tobacco";
  const edible = key === "edible";
  const concentrate = key === "concentrate";
  const addOns = key === "addons" || key === "add on";
  const rank = CATEGORY_ORDER.indexOf(tobacco ? "cigarettes" : edible ? "edibles" : concentrate ? "concentrates" : addOns ? "add ons" : key);
  return rank === -1 ? CATEGORY_ORDER.length : rank;
}

export function sortCategories(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((a, b) => {
    const rank = categoryRank(a) - categoryRank(b);
    return rank === 0 ? a.localeCompare(b) : rank;
  });
}

/** Add Ons is selected when the menu or till opens. */
export function defaultCategory(names: string[]) {
  return names.find((name) => categoryKey(name) === "add ons") ?? names[0] ?? "";
}

export function inStockCategories(rows: { category: string; qty: number }[]) {
  return sortCategories(rows.filter((row) => row.qty > 0).map((row) => row.category));
}
