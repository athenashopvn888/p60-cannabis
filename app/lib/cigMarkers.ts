/**
 * Names the menu feed keeps on the cigarette shelf even while cigarette
 * cartons are hidden: Backwoods, cigarillos, papers, pouches, and wraps.
 * Matching is the same on the website and on the TV boards.
 */
const KEPT_SMOKE_TOKENS = ["BACKWOOD", "CIGARILLO", "PAPER", "POUCH", "ZYN", "VELO", "WRAP"];

export function isKeptSmokeName(name?: string, slug?: string): boolean {
  const blob = `${name || ""} ${slug || ""}`.toUpperCase();
  return KEPT_SMOKE_TOKENS.some((token) => blob.includes(token));
}

/** Real cigarettes and Grabba. Wraps, papers, Backwoods, and nicotine pouches are not. */
export function isRealCigaretteItem(item: { category?: string; name?: string; slug?: string }): boolean {
  const blob = `${item.name || ""} ${item.slug || ""}`;
  if (isKeptSmokeName(item.name, item.slug)) return false;
  if (/\b(pouches?|zyn|zpods?|nvape)\b/i.test(blob)) return false;
  if (/\b(backwoods|cigarillos?|rolling papers?|raw papers?)\b/i.test(blob)) return false;
  if ((item.category || "").toUpperCase() === "CIGARETTES") return true;
  return /\b(cigarettes?|tobacco|marlboro|belmont)\b/i.test(blob);
}
