import {
  FLEET_STORE_NAME,
  TV2_CARDS,
  TV2_PAGE,
  TV_FULLSCREEN_SPOTS,
  TV_PAGE,
  TV_PROMO_EVERY_MINUTES,
  TV_PROMO_SHOW_SECONDS,
} from "./config.ts";
import { safeText } from "./resolve.ts";
import type { ContentBundle, ContentSlot, TvCardSlot, TvFullscreenPromo } from "./types.ts";

const BLOCKED_COPY = /3\.5|farmers\s*link|telnyx/i;

export function inPromoWindow(start: string | undefined, end: string | undefined, now: Date): boolean {
  if (!start?.trim() || !end?.trim()) return false;
  const opens = Date.parse(start);
  const closes = Date.parse(end);
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) return false;
  const time = now.getTime();
  return time >= opens && time < closes;
}

export function safeImage(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || BLOCKED_COPY.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return null;
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function findSlot(bundle: ContentBundle, page: string, spot: string): ContentSlot | undefined {
  return bundle.slots?.find((slot) => slot.page === page && slot.spot === spot);
}

/** Custom uses the row. Follow ALL uses the ALL row when that row is Custom. Coded and Hidden stay coded. */
function customSource(bundle: ContentBundle, slot: ContentSlot): ContentSlot | null {
  if (slot.mode === "Hidden" || slot.mode === "Coded") return null;
  if (slot.mode === "Custom") return slot;
  if (slot.mode !== "Follow ALL") return null;
  const all = bundle.all?.slots?.find((entry) => entry.page === slot.page && entry.spot === slot.spot);
  if (!all || all.mode !== "Custom") return null;
  return all;
}

export function resolveTvCards(bundle: ContentBundle | null, now: Date): Record<string, TvCardSlot> {
  const cards: Record<string, TvCardSlot> = {};
  if (!bundle) return cards;
  for (const card of TV2_CARDS) {
    const slot = findSlot(bundle, TV2_PAGE, card);
    if (!slot) continue;
    const source = customSource(bundle, slot);
    if (!source) continue;
    const promo = inPromoWindow(source.promoStart, source.promoEnd, now) ? safeImage(source.image) : null;
    const off = safeImage(source.offImage);
    if (!promo && !off) continue;
    const alt = safeText(source.alt, card);
    cards[card] = { card, promoImage: promo, promoAlt: alt, offImage: off, offAlt: alt };
  }
  return cards;
}

export function resolveFullscreenPromos(bundle: ContentBundle | null, now: Date): TvFullscreenPromo[] {
  if (!bundle) return [];
  const promos: TvFullscreenPromo[] = [];
  for (const spot of TV_FULLSCREEN_SPOTS) {
    const slot = findSlot(bundle, TV_PAGE, spot);
    if (!slot) continue;
    const source = customSource(bundle, slot);
    if (!source || source.mode !== "Custom") continue;
    if (!inPromoWindow(source.promoStart, source.promoEnd, now)) continue;
    const image = safeImage(source.image);
    if (!image) continue;
    promos.push({
      spot,
      image,
      alt: safeText(source.alt, `${FLEET_STORE_NAME} promotion`),
      showSeconds: positiveNumber(source.showSeconds, TV_PROMO_SHOW_SECONDS),
      everyMinutes: positiveNumber(source.everyMinutes, TV_PROMO_EVERY_MINUTES),
    });
  }
  return promos;
}

export function pickTv2Sheet(
  slot: TvCardSlot | undefined,
  state: { categoryOff: boolean; noItems: boolean; promoBroken: boolean; offBroken: boolean },
): { kind: "promo" | "off"; image: string; alt: string } | null {
  if (!slot) return null;
  if (!state.categoryOff && slot.promoImage && !state.promoBroken) {
    return { kind: "promo", image: slot.promoImage, alt: slot.promoAlt };
  }
  if ((state.categoryOff || state.noItems) && slot.offImage && !state.offBroken) {
    return { kind: "off", image: slot.offImage, alt: slot.offAlt };
  }
  return null;
}
