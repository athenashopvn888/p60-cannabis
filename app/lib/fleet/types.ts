/**
 * Site-side content bundle. The publisher is not live yet; tests use
 * fixtures/fleet. With no manifest configured, pages keep their coded content.
 *
 * Manifest: { storeCode, contentVersion, bundleUrl, publishedAt, jobId }
 * Bundle: {
 *   schemaVersion, storeCode, domain, contentVersion, publishedAt,
 *   sourceHash, jobId, storeInfo?, all?: { slots }, slots?
 * }
 * Each slot: { page, spot, mode, image?, offImage?, imageWidth?, imageHeight?,
 *   textBar?, alt?, title?, caption?, description?, metaTitle?,
 *   metaDescription?, categoryName?, promoStart?, promoEnd?,
 *   showSeconds?, everyMinutes? }
 * Mode is Follow ALL | Custom | Coded | Hidden.
 * storeInfo fields are { mode?, value? }.
 * TV2 spots use page "TV2" and the card name. Fullscreen spots use page "TV".
 */
export const FLEET_SCHEMA_VERSION = 1;
export { FLEET_DOMAIN, FLEET_DOMAINS, FLEET_STORE_CODE } from "./config.ts";
export const FLEET_CONTENT_TAG = "fleet-content";
export const FLEET_MAX_BUNDLE_BYTES = 750_000;

export const FLEET_MODES = ["Follow ALL", "Custom", "Coded", "Hidden"] as const;
export type FieldMode = (typeof FLEET_MODES)[number];

export type ContentField = {
  mode?: FieldMode;
  value?: string;
};

export type StoreInfoFields = {
  name?: ContentField;
  street?: ContentField;
  city?: ContentField;
  province?: ContentField;
  postalCode?: ContentField;
  phone?: ContentField;
  hours?: ContentField;
  area?: ContentField;
  intersection?: ContentField;
  mapsLink?: ContentField;
  mapsEmbed?: ContentField;
  lat?: ContentField;
  lng?: ContentField;
  schemaName?: ContentField;
  website?: ContentField;
};

export type ContentSlot = {
  page: string;
  spot: string;
  mode: FieldMode;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  textBar?: string;
  alt?: string;
  title?: string;
  caption?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  categoryName?: string;
  /** ISO instant. Promo image shows only when now is inside [promoStart, promoEnd). */
  promoStart?: string;
  promoEnd?: string;
  /** Off graphic for a TV2 card when that category is switched off or has no items. */
  offImage?: string;
  showSeconds?: number | string;
  everyMinutes?: number | string;
};

export type ContentManifest = {
  storeCode: string;
  contentVersion: number;
  bundleUrl: string;
  publishedAt: string;
  jobId: string;
};

export type ContentBundle = {
  schemaVersion: number;
  storeCode: string;
  domain: string;
  contentVersion: number;
  publishedAt: string;
  sourceHash: string;
  jobId: string;
  storeInfo?: StoreInfoFields;
  all?: { slots?: ContentSlot[] };
  slots?: ContentSlot[];
};

export type RejectReason =
  | "http"
  | "invalid-json"
  | "schema-version"
  | "wrong-store"
  | "wrong-domain"
  | "missing-identity"
  | "oversized"
  | "published-at-older"
  | "duplicate-version"
  | "decreasing-version";

export type Nap = {
  name: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  cityLine: string;
  area: string;
  intersection: string;
  areaLine: string;
  phoneDisplay: string;
  phoneTel: string;
  hours: string;
  mapsSearchUrl: string;
  mapsEmbedUrl: string;
  lat: string;
  lng: string;
  schemaName: string;
  website: string;
};

export type ResolvedBanner = {
  id: "weed" | "vapes" | "cigarettes" | "premium-cigarettes";
  page: string;
  spot: string;
  href: string;
  categoryName: string;
  hidden: boolean;
  render: "image" | "text";
  image: string;
  /** Slot default. Used when a sheet image fails in the browser. */
  codedImage: string;
  imageWidth?: number;
  imageHeight?: number;
  alt: string;
  title: string;
  textBar: string;
  caption: string;
};

export type ResolvedPage = {
  description: string;
  metaTitle: string;
  metaDescription: string;
};

export type TvCardSlot = {
  card: string;
  promoImage: string | null;
  promoAlt: string;
  offImage: string | null;
  offAlt: string;
};

export type TvFullscreenPromo = {
  spot: string;
  image: string;
  alt: string;
  showSeconds: number;
  everyMinutes: number;
};

export type FleetState = {
  active: boolean;
  version: string;
  contentVersion: number | null;
  /** Blob manifest URL. Empty when the site is on coded content. */
  bundleUrl: string;
  renderedAt: string;
  nap: Nap;
  banners: ResolvedBanner[];
  pages: Record<string, ResolvedPage>;
  tvCards: Record<string, TvCardSlot>;
  fullscreenPromos: TvFullscreenPromo[];
};
