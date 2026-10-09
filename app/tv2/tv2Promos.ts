export const TV2_DAYTIME_START_HOUR = 10;
export const TV2_DAYTIME_END_HOUR = 17;
export const TV2_TIME_ZONE = "America/Toronto";

export const CIGARETTE_OFFER_CYCLE_MS = 30_000;
export const CIGARETTE_OFFER_VISIBLE_MS = 5_000;
export const CIGARETTE_DAYTIME_ROTATION_MS = 10_000;

export type Tv2DaytimePromo = {
  src: string;
  fallbackSrc?: string;
  alt: string;
};

export const CIGARETTE_PROMOS = [
  {
    src: "/banners/luxury_mix_match_600_web.webp",
    alt: "Mix and Match 2 Packs for $5 and $25 Carton Offer",
  },
  {
    src: "/banners/marlboro_belmont_600x600.webp",
    alt: "Marlboro and Belmont $10 Pack Offer",
  },
] as const;

export const TV2_DAYTIME_PROMOS: Readonly<
  Partial<Record<string, Tv2DaytimePromo>>
> = {
  CIGARETTES: {
    src: "/banners/tv2-category-collage.png",
    alt: "Edibles, concentrates, and pre-rolls collage",
  },
  VAPES: {
    src: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/cannabis_banner_mashup_variation_01_600x600.webp",
    fallbackSrc:
      "/banners/cannabis_banner_mashup_variation_01_600x600.webp",
    alt: "Ultimate Cannabis Collection Promo",
  },
};

export function isTv2Daytime(now = new Date()): boolean {
  const hourPart = new Intl.DateTimeFormat("en-CA", {
    timeZone: TV2_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart);
  return hour >= TV2_DAYTIME_START_HOUR && hour < TV2_DAYTIME_END_HOUR;
}

export function getTv2DaytimePromo(
  cardId: string,
  daytime: boolean,
  elapsedMs = 0,
): Tv2DaytimePromo | undefined {
  if (!daytime) return undefined;
  return TV2_DAYTIME_PROMOS[cardId];
}

export function isCigaretteOfferVisible(
  daytime: boolean,
  elapsedMs: number,
): boolean {
  if (daytime || !Number.isFinite(elapsedMs) || elapsedMs < 0) return false;
  return elapsedMs % CIGARETTE_OFFER_CYCLE_MS < CIGARETTE_OFFER_VISIBLE_MS;
}

export function getCigaretteOfferPromo(daytime: boolean, elapsedMs: number) {
  if (!isCigaretteOfferVisible(daytime, elapsedMs)) return undefined;
  const cycle = Math.floor(elapsedMs / CIGARETTE_OFFER_CYCLE_MS);
  return CIGARETTE_PROMOS[cycle % CIGARETTE_PROMOS.length];
}
