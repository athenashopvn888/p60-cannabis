import { getLiveMenu } from "./lib/liveMenu";
import type { MetadataRoute } from "next";
import { DELIVERY_GUIDE_REGISTRY } from "./lib/deliveryGuideRegistry";
import { TIER_CONFIG, CATEGORY_CONFIG } from "./lib/products";
import { SEO_PAGES } from "./lib/seoPages";
import { RESOURCE_PAGES } from "./resources/resourceData";
import { GUIDE_REGISTRY } from "./lib/guideRegistry";

// Products come from the same loader as /api/tv-data on every request.
export const dynamic = "force-dynamic";

// ONE product loader (same as /api/tv-data), filled per request by __loadMenuData(). Grok 2026-10-09.
let __menu!: Awaited<ReturnType<typeof getLiveMenu>>;
async function __loadMenuData(): Promise<void> {
  __menu = await getLiveMenu();

}

const BASE = "https://www.p60cannabis.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    await __loadMenuData();
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/hours`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/visit`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/weed-dispensary-york`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/careers/budtender`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/weed-delivery-york`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  /* Tier pages */
  const tierPages: MetadataRoute.Sitemap = Object.values(TIER_CONFIG).map((t) => ({
    url: `${BASE}/${t.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  /* Item category pages */
  const itemPages: MetadataRoute.Sitemap = Object.values(CATEGORY_CONFIG).map((c) => ({
    url: `${BASE}/items/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  /* Flower detail pages */
  const flowerPages: MetadataRoute.Sitemap = __menu.flowers.map((f) => ({
    url: `${BASE}/flower/${f.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  /* Item detail pages */
  const itemDetailPages: MetadataRoute.Sitemap = __menu.items.map((i) => ({
    url: `${BASE}/item/${i.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  /* SEO landing pages */
  const seoPages: MetadataRoute.Sitemap = SEO_PAGES.map((p) => ({
    url: `${BASE}/info/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const resourcePages: MetadataRoute.Sitemap = RESOURCE_PAGES.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: p.dateModified,
    changeFrequency: p.kind === "update" ? "monthly" as const : "weekly" as const,
    priority: p.kind === "root" ? 0.85 : p.kind === "category" ? 0.75 : 0.7,
  }));

  const guidePages: MetadataRoute.Sitemap = [...GUIDE_REGISTRY, ...DELIVERY_GUIDE_REGISTRY].map((guide) => ({
    url: `${BASE}/guides/${guide.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  return [...staticPages, ...resourcePages, ...tierPages, ...itemPages, ...flowerPages, ...itemDetailPages, ...seoPages, ...guidePages];
}
