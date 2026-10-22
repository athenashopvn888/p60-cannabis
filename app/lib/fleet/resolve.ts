import { CODED_BANNERS, CODED_NAP, CODED_PAGES } from "./coded.ts";
import type { ContentBundle, ContentField, ContentSlot, FieldMode, Nap, ResolvedBanner, ResolvedPage } from "./types.ts";

const BLOCKED_COPY = /3\.5|farmers\s*link|telnyx/i;

export function safeText(value: string | undefined, coded: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || BLOCKED_COPY.test(trimmed)) return coded;
  return trimmed;
}

function slotKey(slot: { page: string; spot: string }): string {
  return `${slot.page}::${slot.spot}`;
}

function allSlot(bundle: ContentBundle, slot: ContentSlot): ContentSlot | undefined {
  return bundle.all?.slots?.find((entry) => slotKey(entry) === slotKey(slot));
}

export function resolveModeValue(mode: FieldMode | undefined, value: string | undefined, coded: string, allValue?: string): { hidden: boolean; value: string } {
  if (mode === "Hidden") return { hidden: true, value: coded };
  if (mode === "Coded" || mode == null) return { hidden: false, value: coded };
  if (mode === "Follow ALL") return { hidden: false, value: safeText(allValue, coded) };
  return { hidden: false, value: safeText(value, coded) };
}

function fieldValue(field: ContentField | undefined, coded: string, allField?: ContentField): string {
  const mode = field?.mode ?? "Coded";
  return resolveModeValue(mode, field?.value, coded, allField?.value).value;
}

/** 10-digit and 1+10-digit numbers become +1 E.164. Anything else keeps the coded tel link. */
export function phoneToTel(display: string, fallback: string): string {
  const digits = display.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return fallback;
}

export function resolveNap(bundle: ContentBundle | null): Nap {
  if (!bundle) return CODED_NAP;
  const info = bundle.storeInfo ?? {};
  const street = fieldValue(info.street, CODED_NAP.street);
  const city = fieldValue(info.city, CODED_NAP.city);
  const province = fieldValue(info.province, CODED_NAP.province);
  const postalCode = fieldValue(info.postalCode, CODED_NAP.postalCode);
  const area = fieldValue(info.area, CODED_NAP.area);
  const intersection = fieldValue(info.intersection, CODED_NAP.intersection);
  const phoneDisplay = fieldValue(info.phone, CODED_NAP.phoneDisplay);
  return {
    name: fieldValue(info.name, CODED_NAP.name),
    street,
    city,
    province,
    postalCode,
    cityLine: `${city}, ${province} ${postalCode}`,
    area,
    intersection,
    areaLine: `${intersection}, ${area}`,
    phoneDisplay,
    phoneTel: phoneToTel(phoneDisplay, CODED_NAP.phoneTel),
    hours: fieldValue(info.hours, CODED_NAP.hours),
    mapsSearchUrl: fieldValue(info.mapsLink, CODED_NAP.mapsSearchUrl),
    mapsEmbedUrl: fieldValue(info.mapsEmbed, CODED_NAP.mapsEmbedUrl),
    lat: fieldValue(info.lat, CODED_NAP.lat),
    lng: fieldValue(info.lng, CODED_NAP.lng),
    schemaName: fieldValue(info.schemaName, CODED_NAP.schemaName),
    website: fieldValue(info.website, CODED_NAP.website),
  };
}

function findSlot(bundle: ContentBundle, page: string, spot: string): ContentSlot | undefined {
  return bundle.slots?.find((slot) => slot.page === page && slot.spot === spot);
}

export function resolveBanners(bundle: ContentBundle | null): ResolvedBanner[] {
  return CODED_BANNERS.map((coded) => {
    if (!bundle) return coded;
    const slot = findSlot(bundle, coded.page, coded.spot);
    if (!slot) return coded;
    const all = allSlot(bundle, slot);
    const mode = slot.mode;
    if (mode === "Hidden") return { ...coded, hidden: true };
    if (mode === "Coded" || (mode === "Follow ALL" && !all)) return coded;
    const source = mode === "Follow ALL" ? all : slot;
    const textBar = safeText(source?.textBar, coded.textBar);
    const alt = safeText(source?.alt, coded.alt);
    const title = safeText(source?.title, coded.title);
    const caption = safeText(source?.caption, textBar);
    const categoryName = safeText(source?.categoryName, coded.categoryName);
    const imageValue = source?.image?.trim() ?? "";
    const missing = imageValue === "";
    return {
      ...coded,
      hidden: false,
      render: missing ? "text" : "image",
      image: missing ? "" : imageValue,
      codedImage: coded.image,
      imageWidth: source?.imageWidth,
      imageHeight: source?.imageHeight,
      alt,
      title,
      textBar,
      caption,
      categoryName,
    };
  });
}

export function resolvePages(bundle: ContentBundle | null): Record<string, ResolvedPage> {
  const pages: Record<string, ResolvedPage> = { ...CODED_PAGES };
  if (!bundle?.slots) return pages;
  for (const slot of bundle.slots) {
    // Banner rows share a page with meta. Only the Page meta spot may change it, and a Coded row keeps the coded meta.
    if (slot.spot !== "Page meta" || slot.mode === "Coded") continue;
    const coded = pages[slot.page] ?? { description: "", metaTitle: "", metaDescription: "" };
    const all = allSlot(bundle, slot);
    const source = slot.mode === "Follow ALL" ? all : slot;
    const mode = slot.mode;
    pages[slot.page] = {
      description: resolveModeValue(mode, source?.description, coded.description, all?.description).value,
      metaTitle: resolveModeValue(mode, source?.metaTitle, coded.metaTitle, all?.metaTitle).value,
      metaDescription: resolveModeValue(mode, source?.metaDescription, coded.metaDescription, all?.metaDescription).value,
    };
  }
  return pages;
}
