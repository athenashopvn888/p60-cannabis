export const TV2_DAYTIME_START_HOUR = 10;
export const TV2_DAYTIME_END_HOUR = 17;

export const CIGARETTE_OFFER_CYCLE_MS = 30_000;
export const CIGARETTE_OFFER_VISIBLE_MS = 5_000;

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
  VAPES: {
    src: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/cannabis_banner_mashup_variation_01_600x600.webp",
    fallbackSrc:
      "/banners/cannabis_banner_mashup_variation_01_600x600.webp",
    alt: "Ultimate Cannabis Collection Promo",
  },
};

export function isTv2Daytime(now = new Date()): boolean {
  const hour = now.getHours();
  return hour >= TV2_DAYTIME_START_HOUR && hour < TV2_DAYTIME_END_HOUR;
}

export function getTv2DaytimePromo(
  cardId: string,
  daytime: boolean,
): Tv2DaytimePromo | undefined {
  return daytime ? TV2_DAYTIME_PROMOS[cardId] : undefined;
}

export function isCigaretteOfferVisible(
  elapsedMs: number,
): boolean {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return false;
  return elapsedMs % CIGARETTE_OFFER_CYCLE_MS < CIGARETTE_OFFER_VISIBLE_MS;
}

export function getCigaretteOfferPromo(elapsedMs: number) {
  if (!isCigaretteOfferVisible(elapsedMs)) return undefined;
  const cycle = Math.floor(elapsedMs / CIGARETTE_OFFER_CYCLE_MS);
  return CIGARETTE_PROMOS[cycle % CIGARETTE_PROMOS.length];
}
