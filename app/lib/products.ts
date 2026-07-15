/* -- Product & Item Types -- */
export interface FlowerProduct {
  sku: string;
  name: string;
  slug: string;
  tier: string;
  type: "indica" | "sativa" | "hybrid";
  isHot: boolean;
  isSale: boolean;
  thc: string;
  price3g: PricePoint | null;
  price5g: PricePoint | null;
  price14g: PricePoint | null;
  price28g: PricePoint | null;
  image: string;
}

export interface PricePoint {
  regular: number;
  sale: number | null;
}

export interface ItemProduct {
  sku: string;
  name: string;
  slug: string;
  category: string;
  type: string;
  thc: string;
  mg: string;
  price: string;
  image: string;
  promoImage: string | null;
}

/* Data imports (static fallback) */
import flowersJson from "./flowers.json";
import itemsJson from "./items.json";

export const allFlowers: FlowerProduct[] = flowersJson as FlowerProduct[];
export const allItems: ItemProduct[] = itemsJson as ItemProduct[];

/* Live stock fetch from Apps Script */
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

interface LiveStockResponse {
  flowers: FlowerProduct[];
  items: ItemProduct[];
  storeCode?: string;
  stockDate?: string;
}

/**
 * Fetch live stock-filtered products from Apps Script endpoint.
 * Used at build time (getStaticProps / generateStaticParams).
 * Falls back to static JSON if endpoint not configured.
 */
export async function fetchLiveProducts(): Promise<{
  flowers: FlowerProduct[];
  items: ItemProduct[];
  isLive: boolean;
  stockDate: string | null;
}> {
  if (!APPS_SCRIPT_URL) {
    return { flowers: allFlowers, items: allItems, isLive: false, stockDate: null };
  }

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?store=PNY01`, {
      next: { revalidate: 300 }, // Cache for 5 min during build
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: LiveStockResponse = await res.json();
    return {
      flowers: data.flowers || allFlowers,
      items: data.items || allItems,
      isLive: true,
      stockDate: data.stockDate || null,
    };
  } catch (err) {
    console.warn("[products] Live fetch failed, using static data:", err);
    return { flowers: allFlowers, items: allItems, isLive: false, stockDate: null };
  }
}

export const TIER_CONFIG: Record<
  string,
  {
    name: string; slug: string; color: string; icon: string; tagline: string; banner: string;
    unitPrice: number; /* $/g */
    deal3g: { label: string; total: string; price: number } | null; /* 3g bundle pricing */
    deal6g: { label: string; total: string; price: number } | null; /* 6g bundle pricing (top 3 only) */
  }
> = {
  EXOTIC: {
    name: "Exotic",
    slug: "exotic",
    color: "#f59e0b",
    icon: "\uD83D\uDD25",
    tagline: "Explore the current Exotic flower menu",
    banner: "/banners/p60-real/tier-exotic.webp",
    unitPrice: 20,
    deal3g: { label: "3g bundle", total: "3G", price: 40 },
    deal6g: { label: "6g bundle", total: "6G", price: 60 },
  },
  PREMIUM: {
    name: "Premium",
    slug: "premium",
    color: "#a78bfa",
    icon: "\uD83D\uDC8E",
    tagline: "Explore the current Premium flower menu",
    banner: "/banners/p60-real/tier-premium.webp",
    unitPrice: 15,
    deal3g: { label: "3g bundle", total: "3G", price: 30 },
    deal6g: { label: "6g bundle", total: "6G", price: 45 },
  },
  "AAA+": {
    name: "AAA+",
    slug: "aaa",
    color: "#22d3ee",
    icon: "\u26A1",
    tagline: "Explore the current AAA+ flower menu",
    banner: "/banners/p60-real/tier-aaa.webp",
    unitPrice: 10,
    deal3g: { label: "3g bundle", total: "3G", price: 20 },
    deal6g: { label: "6g bundle", total: "6G", price: 30 },
  },
  AA: {
    name: "AA",
    slug: "aa",
    color: "#34d399",
    icon: "\u2726",
    tagline: "Explore the current AA flower menu",
    banner: "/banners/p60-real/tier-aa.webp",
    unitPrice: 4,
    deal3g: null,
    deal6g: null,
  },
  BUDGET: {
    name: "Budget",
    slug: "budget",
    color: "#94a3b8",
    icon: "\uD83D\uDCB0",
    tagline: "Shreds & value OZs \u00B7 From $40/oz",
    banner: "/banners/p60-real/tier-budget.webp",
    unitPrice: 3,
    deal3g: { label: "$10 / 3g Special", total: "3G", price: 10 },
    deal6g: null,
  },
};

/* Item category config */
export interface CategoryInfo {
  name: string; slug: string; color: string; icon: string; banner?: string;
  seoTitle: string; seoIntro: string; seoDescription: string;
  faqs: { q: string; a: string }[];
}

export const CATEGORY_CONFIG: Record<string, CategoryInfo> = {
  EDIBLES: {
    banner: "/banners/p60-real/category-edibles.webp",
    name: "Edibles", slug: "edibles", color: "#f97316", icon: "ED",
    seoTitle: "Cannabis Edibles York - Gummies, Chocolates & Drinks",
    seoIntro: "Browse the cannabis edibles category at P60 Cannabis on Weston Rd in York. Check the current menu for today's edible listings.",
    seoDescription: "Looking for cannabis edibles in York? Use the P60 Cannabis edibles category to compare current menu listings, then confirm product details before visiting 1938 Weston Rd.",
    faqs: [
      { q: "What edible formats may be listed?", a: "The category may include gummies, chocolates, beverages, capsules, and baked goods. Check the current menu for item details." },
      { q: "Where can I find item details?", a: "Check the current menu and product package for item-specific details." },
      { q: "Can I buy edibles at P60 Cannabis?", a: "Yes! Visit us at 1938 Weston Rd, York. We're open daily from 10:00 AM to 03:00 AM with a full edibles selection in store." },
    ],
  },
  "VAPE PENS": {
    banner: "/banners/p60-real/category-thc-vape.webp",
    name: "THC Vape", slug: "vapes", color: "#8b5cf6", icon: "VP",
    seoTitle: "Vape Pens in York | P60 Cannabis",
    seoIntro: "Browse vape category information at P60 Cannabis in York.",
    seoDescription: "Review vape-related menu categories at P60 Cannabis in York and confirm current menu details before visiting. This page is intended for general category browsing and does not promise current product selection.",
    faqs: [
      { q: "What vape information can shoppers review?", a: "Visitors can use this page to review vape category information and then confirm current menu details before visiting P60 Cannabis." },
      { q: "Does this page guarantee current vape selection?", a: "No. Category details can change, so customers should confirm the current menu before visiting." },
    ],
  },
  "VAPE DISPOSABLE": {
    banner: "/banners/p60-real/category-nic-vape.webp",
    name: "Nic Vape", slug: "vape-disposables", color: "#a78bfa", icon: "NV",
    seoTitle: "Disposable Vapes York - THC Disposable Pens",
    seoIntro: "Browse disposable vape category information at P60 Cannabis in York.",
    seoDescription: "Use the P60 Cannabis disposable vape category to compare current menu listings, then confirm product details before visiting 1938 Weston Rd in York.",
    faqs: [
      { q: "How long does a disposable vape last?", a: "Most disposable THC vapes contain 0.5g-1g of distillate and last between 100-300 puffs depending on usage." },
      { q: "Are disposable vapes rechargeable?", a: "Most are designed for single use, but some models include a USB-C charging port to ensure you can use the full cartridge." },
    ],
  },
  CONCENTRATES: {
    banner: "/banners/p60-real/category-concentrates.webp",
    name: "Concentrates", slug: "concentrates", color: "#f59e0b", icon: "CO",
    seoTitle: "Cannabis Concentrates in York | P60 Cannabis",
    seoIntro: "Browse concentrates category information at P60 Cannabis in York.",
    seoDescription: "Review concentrate-related menu categories at P60 Cannabis in York and confirm current menu details before visiting. This page is intended for general category browsing and does not promise current product selection.",
    faqs: [
      { q: "What concentrate information can shoppers review?", a: "Visitors can use this page to review concentrates category information and then confirm current menu details before visiting P60 Cannabis." },
      { q: "Does this page guarantee current concentrate selection?", a: "No. Category details can change, so customers should confirm the current menu before visiting." },
    ],
  },
  PREROLLS: {
    banner: "/banners/p60-real/category-prerolls.webp", name: "Pre-Rolls", slug: "prerolls", color: "#22c55e", icon: "PR",
    seoTitle: "Pre-Rolls in York | P60 Cannabis",
    seoIntro: "Browse pre-roll category information at P60 Cannabis in York.",
    seoDescription: "Review pre-roll menu categories at P60 Cannabis in York and confirm current menu details before visiting. This page is intended for general category browsing and does not promise current product selection.",
    faqs: [
      { q: "What pre-roll information can shoppers review?", a: "Visitors can use this page to review pre-roll category information and then confirm current menu details before visiting P60 Cannabis." },
      { q: "Does this page guarantee current pre-roll selection?", a: "No. Category details can change, so customers should confirm the current menu before visiting." },
    ],
  },
  "ADD ONS": {
    banner: "/banners/p60-real/category-accessories.webp",
    name: "Accessories", slug: "add-ons", color: "#34d399", icon: "+",
    seoTitle: "Cannabis Accessories York - Grinders, Papers, Lighters & More",
    seoIntro: "Essential cannabis accessories at P60 Cannabis, York. Grinders, rolling papers, lighters, trays, and more.",
    seoDescription: "Use the P60 Cannabis accessories category to compare current menu listings, then confirm product details before visiting 1938 Weston Rd in York.",
    faqs: [
      { q: "What accessories do you sell?", a: "We carry grinders, rolling papers, filter tips, lighters, rolling trays, storage jars, and more." },
    ],
  },
  "MAGIC & OTHERS": {
    banner: "/banners/p60-real/category-magic.webp",
    name: "Magic Stuff", slug: "magic", color: "#64748b", icon: "*",
    seoTitle: "Magic Stuff - Specialty Items",
    seoIntro: "Browse current menu for listed specialty products. Selection may vary by store.",
    seoDescription: "Specialty item listings can change by store and by day. Check the current menu for current selection.",
    faqs: [
      { q: "What specialty items are listed?", a: "Selection varies by store and by day. Check the current menu for listed specialty products." },
      { q: "Does selection vary by location?", a: "Yes. Specialty item selection may vary by store, so please check the current menu for this location." },
    ],
  },
  CIGARETTES: {
    banner: "/banners/p60-real/category-cigarettes.webp",
    name: "Cigarettes", slug: "cigarettes", color: "#78716c", icon: "SM",
    seoTitle: "Native Cigarettes York - P60 Cannabis",
    seoIntro: "Browse cigarette category information at P60 Cannabis on Weston Rd in York.",
    seoDescription: "Use the P60 Cannabis cigarette category to compare current listings, then confirm today's product details before visiting 1938 Weston Rd in York.",
    faqs: [
      { q: "Do you sell cigarettes at P60 Cannabis?", a: "Yes! We carry a wide selection of native cigarette brands at competitive prices." },
      { q: "What cigarette brands may be listed?", a: "Check the current cigarette category for listed brands and prices." },
      { q: "How should shoppers confirm cigarette prices?", a: "Use the current menu or ask staff for today's cigarette prices and selection." },
    ],
  },
};

/* Helper functions */
export function getFlowersByTier(tier: string): FlowerProduct[] {
  return allFlowers.filter(
    (f) => f.tier.toUpperCase() === tier.toUpperCase()
  );
}

export function getFlowerBySlug(slug: string): FlowerProduct | undefined {
  return allFlowers.find((f) => f.slug === slug);
}

export function getItemsByCategory(category: string): ItemProduct[] {
  return allItems.filter(
    (i) => i.category.toUpperCase() === category.toUpperCase()
  );
}

export function getTierFromSlug(
  slug: string
): { key: string; config: (typeof TIER_CONFIG)[string] } | undefined {
  const entry = Object.entries(TIER_CONFIG).find(
    ([, v]) => v.slug === slug
  );
  if (!entry) return undefined;
  return { key: entry[0], config: entry[1] };
}

export function getCategoryFromSlug(
  slug: string
): { key: string; config: (typeof CATEGORY_CONFIG)[string] } | undefined {
  const entry = Object.entries(CATEGORY_CONFIG).find(
    ([, v]) => v.slug === slug
  );
  if (!entry) return undefined;
  return { key: entry[0], config: entry[1] };
}

export function getLowestPrice(flower: FlowerProduct): number | null {
  const prices = [flower.price3g, flower.price5g, flower.price14g, flower.price28g]
    .filter((p): p is PricePoint => p !== null)
    .map((p) => p.sale ?? p.regular);
  return prices.length ? Math.min(...prices) : null;
}

export function formatPrice(p: PricePoint | null): string {
  if (!p) return "-";
  if (p.sale !== null) return `$${p.sale}`;
  return `$${p.regular}`;
}
