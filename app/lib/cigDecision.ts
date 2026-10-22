import { isRealCigaretteItem } from "./cigMarkers.ts";
import { cigaretteEnvHardOff } from "./siteConfig.ts";

/** How often cigarette on/off is allowed to change without a rebuild. */
export const CIGARETTE_REVALIDATE_SECONDS = 60;

export type CigaretteWording = {
  bannerText: string;
  promoBrands: string;
  tv2BoardTitle: string;
  wrapsTitle: string;
  tickerLine1: string;
  priceTwoPack: string;
  priceCarton: string;
  priceBelmont: string;
  priceBB2Pack: string;
};

/** Current on-screen copy, used when the feed omits a wording field. */
export const CIG_WORDING_FALLBACK: CigaretteWording = {
  bannerText: "2 PACKS $5 / $25 CARTON",
  promoBrands: "BB Full Flavor + Lights 2 packs $5 · Marlboro & Belmont $10/pack",
  tv2BoardTitle: "🚬 CIGARETTES",
  wrapsTitle: "🚬 WRAPS & POUCHES",
  tickerLine1: "CIGARETTES 2 PACK $5 MIX MATCH !",
  priceTwoPack: "2 PACKS $5",
  priceCarton: "$25 CARTON",
  priceBelmont: "$10/pack",
  priceBB2Pack: "2 packs $5",
};

export type CigaretteSurface = "web" | "tv";

export type CigaretteReason = "env" | "error" | "missing" | "off" | "no-items" | "on";

export type CigaretteSurfaceDecision = {
  show: boolean;
  reason: CigaretteReason;
};

type ShelfItem = { category?: string; name?: string; slug?: string; sku?: string };

function wordingText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function resolveCigWording(wording: unknown): CigaretteWording {
  const source = wording && typeof wording === "object" && !Array.isArray(wording)
    ? wording as Record<string, unknown>
    : {};
  return {
    bannerText: wordingText(source.bannerText, CIG_WORDING_FALLBACK.bannerText),
    promoBrands: wordingText(source.promoBrands, CIG_WORDING_FALLBACK.promoBrands),
    tv2BoardTitle: wordingText(source.tv2BoardTitle, CIG_WORDING_FALLBACK.tv2BoardTitle),
    wrapsTitle: wordingText(source.wrapsTitle, CIG_WORDING_FALLBACK.wrapsTitle),
    tickerLine1: wordingText(source.tickerLine1, CIG_WORDING_FALLBACK.tickerLine1),
    priceTwoPack: wordingText(source.priceTwoPack, CIG_WORDING_FALLBACK.priceTwoPack),
    priceCarton: wordingText(source.priceCarton, CIG_WORDING_FALLBACK.priceCarton),
    priceBelmont: wordingText(source.priceBelmont, CIG_WORDING_FALLBACK.priceBelmont),
    priceBB2Pack: wordingText(source.priceBB2Pack, CIG_WORDING_FALLBACK.priceBB2Pack),
  };
}

/** Website surfaces read webOn. TV surfaces read tvOn. A missing side flag falls back to cig.on. Only an explicit false hides the surface. */
export function resolveSurfaceFlag(cig: unknown, surface: CigaretteSurface): boolean {
  if (!cig || typeof cig !== "object" || Array.isArray(cig)) return false;
  const block = cig as Record<string, unknown>;
  const specific = surface === "web" ? block.webOn : block.tvOn;
  const fallback = block.on;
  if (specific === false) return false;
  if (typeof specific === "boolean") return specific;
  if (fallback === false) return false;
  if (typeof fallback === "boolean") return fallback;
  return true;
}

export function decideCigaretteSurface(input: {
  cig: unknown;
  items?: ShelfItem[] | null;
  surface: CigaretteSurface;
  envRaw?: string;
  errored?: boolean;
}): CigaretteSurfaceDecision & { wording: CigaretteWording } {
  const wording = resolveCigWording(
    input.cig && typeof input.cig === "object" && !Array.isArray(input.cig)
      ? (input.cig as { wording?: unknown }).wording
      : undefined,
  );
  if (cigaretteEnvHardOff(input.envRaw)) return { show: false, reason: "env", wording };
  // A missing feed or a feed error shows cigarettes. Only an explicit false flag hides them.
  if (input.errored) return { show: true, reason: "error", wording };
  if (!input.cig || typeof input.cig !== "object" || Array.isArray(input.cig)) {
    return { show: true, reason: "missing", wording };
  }
  if (!resolveSurfaceFlag(input.cig, input.surface)) return { show: false, reason: "off", wording };
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.some((item) => isRealCigaretteItem(item))) return { show: false, reason: "no-items", wording };
  return { show: true, reason: "on", wording };
}

/** Guide pages follow the master switch (`master`, otherwise `on`), not the web/TV split. */
export function decideCigaretteGuide(input: {
  cig: unknown;
  items?: ShelfItem[] | null;
  envRaw?: string;
  errored?: boolean;
}): CigaretteSurfaceDecision {
  if (cigaretteEnvHardOff(input.envRaw)) return { show: false, reason: "env" };
  if (input.errored) return { show: true, reason: "error" };
  if (!input.cig || typeof input.cig !== "object" || Array.isArray(input.cig)) {
    return { show: true, reason: "missing" };
  }
  const block = input.cig as Record<string, unknown>;
  const master = typeof block.master === "boolean" ? block.master : undefined;
  const on = typeof block.on === "boolean" ? block.on : undefined;
  const flag = master !== undefined ? master : on;
  if (flag === false) return { show: false, reason: "off" };
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.some((item) => isRealCigaretteItem(item))) return { show: false, reason: "no-items" };
  return { show: true, reason: "on" };
}

/** Drop real cigarettes when this surface is off. Always keep wraps and pouches. */
export function reconcileSurfaceItems<T extends ShelfItem>(menuItems: T[], liveItems: T[], show: boolean): T[] {
  if (!show) return menuItems.filter((item) => !isRealCigaretteItem(item));
  const seen = new Set(menuItems.map((item) => item.slug || item.sku || item.name));
  const extras = liveItems.filter((item) => {
    const key = item.slug || item.sku || item.name;
    return Boolean(key) && !seen.has(key) && isRealCigaretteItem(item);
  });
  return extras.length ? [...menuItems, ...extras] : menuItems;
}

export function cigarettePublicHeaders(state: { web: boolean; tv: boolean; wording: CigaretteWording }): Record<string, string> {
  return {
    "x-tv-data-cig-tv": state.tv ? "1" : "0",
    "x-tv-data-cig-web": state.web ? "1" : "0",
    "x-tv-data-cig-wording": encodeURIComponent(JSON.stringify(state.wording)),
  };
}

export function readCigaretteTvHeader(headers: { get(name: string): string | null }): { show: boolean; wording: CigaretteWording } {
  const show = headers.get("x-tv-data-cig-tv") === "1";
  const raw = headers.get("x-tv-data-cig-wording");
  if (!raw) return { show, wording: { ...CIG_WORDING_FALLBACK } };
  try {
    return { show, wording: resolveCigWording(JSON.parse(decodeURIComponent(raw))) };
  } catch {
    return { show, wording: { ...CIG_WORDING_FALLBACK } };
  }
}
