import guideCopy from "./guideCopy.json";
import { allFlowers, allItems, type FlowerProduct, type ItemProduct } from "./products";

export type GuideLane = "strain" | "native_cig" | "nic_vape" | "thc_vape";
export type GuideFaq = { question: string; answer: string };

type GuideSchema = {
  types: Array<"FAQPage" | "Product" | "WebPage">;
  faq_item_count: number;
  faq_items: GuideFaq[];
  product_notes?: string;
  omit_offers: true;
  omit_aggregate_rating?: boolean;
};

type GuideCopyEntry = {
  slug: string;
  lane: GuideLane;
  h1: string;
  short_blurb: string;
  body_md: string;
  related_slugs: string[];
  category_path_hint: string;
  seo: { primary_keywords: string[]; schema: GuideSchema };
};

export type GuideEntry = {
  slug: string;
  lane: GuideLane;
  name: string;
  title: string;
  description: string;
  bodyMd: string;
  preferredCategoryPath: string;
  relatedSlugs: string[];
  primaryKeywords: string[];
  schema: GuideSchema;
};

export const GUIDE_STORE = {
  code: "PNY01",
  brand: "P60 Cannabis",
  domain: "p60cannabis.com",
  corridor: "Weston Road / York",
} as const;

const laneSuffix = (lane: GuideLane) => ({
  strain: "",
  native_cig: " Native Cigarettes",
  nic_vape: " Nicotine Vape",
  thc_vape: " THC Vape",
})[lane];

const deriveName = (entry: GuideCopyEntry) => {
  const headingName = entry.h1.split(" at ")[0]?.trim() || entry.h1;
  const suffix = laneSuffix(entry.lane);
  return suffix && headingName.endsWith(suffix) ? headingName.slice(0, -suffix.length) : headingName;
};

export const GUIDE_REGISTRY: GuideEntry[] = (guideCopy as GuideCopyEntry[]).map((entry) => ({
  slug: entry.slug,
  lane: entry.lane,
  name: deriveName(entry),
  title: entry.h1,
  description: entry.short_blurb,
  bodyMd: entry.body_md,
  preferredCategoryPath: entry.category_path_hint,
  relatedSlugs: entry.related_slugs,
  primaryKeywords: entry.seo.primary_keywords,
  schema: entry.seo.schema,
}));

export const getGuide = (slug: string) => GUIDE_REGISTRY.find((guide) => guide.slug === slug);
const GUIDE_LANES: { lane: GuideLane; label: string }[] = [
  { lane: "strain", label: "Strains" },
  { lane: "native_cig", label: "Native Cigarettes" },
  { lane: "nic_vape", label: "Nicotine Vape" },
  { lane: "thc_vape", label: "THC Vape" },
];

export function getGuidesByLane(lane: GuideLane): GuideEntry[];
export function getGuidesByLane(): { lane: GuideLane; label: string; guides: GuideEntry[] }[];
export function getGuidesByLane(lane?: GuideLane) {
  if (lane) return GUIDE_REGISTRY.filter((guide) => guide.lane === lane);
  return GUIDE_LANES.map(({ lane, label }) => ({
    lane,
    label,
    guides: GUIDE_REGISTRY.filter((guide) => guide.lane === lane),
  })).filter((group) => group.guides.length > 0);
}

const normalized = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
export function resolveGuideProduct(guide: GuideEntry): FlowerProduct | ItemProduct | undefined {
  const products = guide.lane === "strain" ? allFlowers : allItems;
  return products.find((product) => product.slug === guide.slug)
    ?? products.find((product) => normalized(product.name).includes(normalized(guide.name)));
}

export const getTierGuideLinks = (categoryPath: string, limit = 6) => GUIDE_REGISTRY
  .filter((guide) => guide.lane === "strain" && guide.preferredCategoryPath === categoryPath)
  .slice(0, limit);

export function getCategoryGuideGroups(categoryPath: string) {
  if (categoryPath === "/items/cigarettes") return [{ label: "Native Cigarettes brand guides", guides: GUIDE_REGISTRY.filter((guide) => guide.lane === "native_cig").slice(0, 9) }];
  if (categoryPath === "/items/vapes") return [
    { label: "Nicotine Vape brand guides", guides: GUIDE_REGISTRY.filter((guide) => guide.lane === "nic_vape").slice(0, 6) },
    { label: "Separate THC Vape guides", guides: GUIDE_REGISTRY.filter((guide) => guide.lane === "thc_vape").slice(0, 3) },
  ];
  if (categoryPath === "/items/vape-disposables") return [{ label: "THC Vape guides", guides: GUIDE_REGISTRY.filter((guide) => guide.lane === "thc_vape").slice(0, 3) }];
  return [];
}
