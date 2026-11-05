import { STORE_TZ } from "./constants.ts";

export function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100).toLocaleString("en-CA");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

export function roundCents(amountCents: number) {
  return Math.round(Number(amountCents));
}

/** True only when the deposit is strictly above cash on hand, after both amounts are rounded to cents. */
export function depositAboveCash(amountCents: number, cashOnHandCents: number) {
  return roundCents(amountCents) > roundCents(cashOnHandCents);
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

/** Short chip text. The stored category name stays unchanged. */
const CHIP_LABELS: Record<string, string> = {
  "add ons": "Add Ons",
  cigarettes: "Cigs",
  cigarette: "Cigs",
  tobacco: "Cigs",
  prerolls: "PreRolls",
  "pre rolls": "PreRolls",
  preroll: "PreRolls",
  edibles: "Edibles",
  edible: "Edibles",
  "magic & others": "Magic",
  magic: "Magic",
  "vape disposable": "THC Vape",
  "vape pens": "Nic Vape",
};

export function categoryChipLabel(name: string) {
  return CHIP_LABELS[categoryKey(name)] ?? name;
}

function isAddOnCategory(name: string) {
  const key = categoryKey(name);
  return key === "add ons" || key === "addons" || key === "add on";
}

function isNicVapeCategory(name: string) {
  return categoryKey(name) === "vape pens";
}

function isCigCategory(name: string) {
  const key = categoryKey(name);
  return key === "cigarettes" || key === "cigarette" || key === "tobacco";
}

function swapAt(names: string[], left: number, right: number) {
  if (left < 0 || right < 0 || left === right) return;
  const saved = names[left];
  names[left] = names[right];
  names[right] = saved;
}

/** Same grid. Nic Vape stays in Add Ons' old cell. Cigs takes the wide last cell, and Add Ons takes Cigs' old cell. */
export function layoutCategoryChips(names: string[]) {
  const ordered = [...names];
  swapAt(ordered, ordered.findIndex(isAddOnCategory), ordered.findIndex(isNicVapeCategory));
  swapAt(ordered, ordered.findIndex(isCigCategory), ordered.findIndex(isAddOnCategory));
  return ordered;
}

/** Add Ons is selected when the customer menu opens. */
export function defaultCategory(names: string[]) {
  return names.find((name) => categoryKey(name) === "add ons") ?? names[0] ?? "";
}

/** Cigs is selected when the POS opens. */
export function posDefaultCategory(names: string[]) {
  return names.find(isCigCategory) ?? defaultCategory(names);
}

export function inStockCategories(rows: { category: string; qty: number }[]) {
  return sortCategories(rows.filter((row) => row.qty > 0).map((row) => row.category));
}
