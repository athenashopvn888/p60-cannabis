export const CIGARETTE_FLASH_MESSAGE = "CIGARETTES 2 PACK $5 MIX MATCH !";

export function isCigaretteFlashWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return hour >= 17 || hour < 8;
}

/** 08:00-17:00 America/Toronto: no cigarette or nicotine vape content on TV/TV2. */
export function isNicotineQuietWindow(now: Date = new Date()): boolean {
  return !isCigaretteFlashWindow(now);
}

const NICOTINE_NAME = /\bN\s?VAPE\b|NICOTINE|E-?LIQUID/i;
export function isNicotineItem(item: { name?: string; category?: string }): boolean {
  return item.category === "CIGARETTES" || NICOTINE_NAME.test(String(item.name || ""));
}
