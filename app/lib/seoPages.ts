const NATIVE_HERO_DISCLOSURE = "Brand preview only. Selection varies by store; check the current cigarette menu before visiting.";
const NATIVE_HERO_PRODUCTS = [
  { name: "BB Lights", image: "/products/1001-BB-LIGHTS-CARTONS.webp" },
  { name: "BB Full", image: "/products/1003-BB-FULL-CARTON.webp" },
  { name: "Canadian Lights", image: "/products/1005-CANADIAN-LIGHTS.webp" },
  { name: "Canadian Full", image: "/products/1006-CANADIAN-FULL.webp" },
  { name: "Canadian Classics Silver", image: "/products/1015-CANADIAN-CLASSICS-SILVER.webp" },
  { name: "Canadian Menthol", image: "/products/1013-CANADIAN-MENTHOL.webp" },
] as const;

export interface SeoPageData {
  slug: string;
  title: string;
  absoluteTitle?: boolean;
  metaDescription: string;
  h1: string;
  icon: string;
  heroTagline: string;
  heroPreview?: {
    eyebrow: string;
    intro: string;
    products: readonly { name: string; image: string; sourceSlug?: string }[];
    disclosure: string;
    theme?: "cigarettes" | "nicotine";
    menuHref?: string;
    primaryLabel?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
    identityStrip?: string;
    featuredHeading?: string;
    featuredIntro?: string;
    warning?: string;
  };
  banner?: string;
  sections: { heading: string; body: string }[];
  faqs: { q: string; a: string }[];
}

export const SEO_PAGES: SeoPageData[] = [
  {
    slug: "york-weed-dispensary",
    title: "York Weed Dispensary - P60 Cannabis",
    metaDescription: "P60 Cannabis is a York weed dispensary at 1938 Weston Rd with flower tiers, pre-rolls, vapes, edibles, concentrates, cigarettes, accessories, and local store details.",
    h1: "York Weed Dispensary - P60 Cannabis",
    icon: "*",
    heroTagline: "1938 Weston Rd in York - open 24 hours daily",
    banner: "/banners/p60-real/page-york.webp",
    sections: [
      {
        heading: "Visit P60 Cannabis On Weston Rd",
        body: "P60 Cannabis is located at 1938 Weston Rd in York. Use this page for the basic store context, then use the current menu or staff for product names, posted prices, and selection details that can change.",
      },
      {
        heading: "Shop By Category First",
        body: "Flower, pre-rolls, edibles, THC vapes, concentrates, cigarettes, and accessories all compare differently. Start with the category that matches the visit, then compare the current item details inside that category.",
      },
      {
        heading: "Local York Store Notes",
        body: "The store page, directions, contact options, and listed hours are the right starting point for a Weston Rd visit. P60 Cannabis is listed at 1938 Weston Rd, York, ON M9N 1W2.",
      },
    ],
    faqs: [
      { q: "Where is P60 Cannabis located?", a: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." },
      { q: "What are the listed hours for P60 Cannabis?", a: "P60 Cannabis is open 24 hours daily." },
      { q: "What should shoppers check before visiting?", a: "Check the current menu, category pages, directions, contact options, and listed hours before visiting." },
    ],
  },
  {
    slug: "cheap-weed-york",
    title: "Cheap Weed York - P60 Cannabis Value Guide",
    metaDescription: "A P60 Cannabis value guide for York shoppers comparing budget flower, AA flower, bundle notes, and current menu details.",
    h1: "Cheap Weed York - P60 Cannabis Value Guide",
    icon: "$",
    heroTagline: "Budget and value shopping notes for York",
    banner: "/banners/p60-real/page-budget.webp",
    sections: [
      {
        heading: "Start With Budget And AA",
        body: "If value is the goal, start with the Budget and AA flower categories before jumping across the rest of the menu. That keeps the comparison focused on lower-spend options first.",
      },
      {
        heading: "Compare Current Menu Details",
        body: "Use the current product name, format, size, posted price, and listing details when comparing value options. Menus can change, so this page is a shopping guide rather than a promise of live selection.",
      },
      {
        heading: "Move Up Only If It Fits The Visit",
        body: "If Budget or AA does not fit the visit, compare AAA+, Premium, or Exotic next. The better decision starts with the category, then the current item details.",
      },
    ],
    faqs: [
      { q: "Where should value shoppers start at P60 Cannabis?", a: "Start with Budget and AA flower, then compare the current menu details." },
      { q: "Does this page guarantee current prices?", a: "No. Use the current menu or ask staff for product, price, and selection details." },
      { q: "Can shoppers compare other categories too?", a: "Yes. Use the menu sections for flower, pre-rolls, edibles, vapes, concentrates, accessories, and cigarettes where listed." },
    ],
  },
  {
    slug: "native-cigarettes-york",
    title: "Native Cigarettes York - P60 Cannabis",
    metaDescription: "P60 Cannabis native cigarettes resource for York shoppers, with cigarette category notes and a reminder to confirm current listings before visiting.",
    h1: "Native Cigarettes York - P60 Cannabis",
    icon: "#",
    heroTagline: "Cigarette category notes for 1938 Weston Rd",
    heroPreview: {
      eyebrow: "P60 Cannabis · 1938 Weston Rd, York",
      intro: "Cigarette category notes for 1938 Weston Rd",
      products: NATIVE_HERO_PRODUCTS,
      disclosure: NATIVE_HERO_DISCLOSURE,
    },
    banner: "/banners/p60-real/page-cigarettes.webp",
    sections: [
      {
        heading: "Start With The Cigarette Category",
        body: "If cigarettes are part of the visit, open the cigarette category first and compare the current listings. Product names, carton options, and prices can change.",
      },
      {
        heading: "Keep Cannabis And Cigarettes Separate",
        body: "Flower, pre-rolls, edibles, THC vapes, and concentrates should be compared separately from cigarette listings. One category at a time keeps the visit easier to plan.",
      },
      {
        heading: "Confirm What Matters Today",
        body: "When a specific brand, carton, light, full, or menthol option matters, use the current menu or ask staff before choosing.",
      },
    ],
    faqs: [
      { q: "Does P60 Cannabis list cigarette options?", a: "The site includes a cigarette category. Check the current menu or ask staff for today's listings." },
      { q: "Are cigarette prices current on this page?", a: "Confirm current prices and selection with the menu or staff." },
      { q: "Where is the store?", a: "P60 Cannabis is at 1938 Weston Rd, York, ON M9N 1W2." },
    ],
  },
  {
    slug: "weed-store-near-toronto",
    title: "Weed Store Near Toronto - P60 Cannabis",
    metaDescription: "Looking for a weed store near Toronto or York? P60 Cannabis is located at 1938 Weston Rd with store details, menu categories, and visit-planning notes.",
    h1: "Weed Store Near Toronto - P60 Cannabis",
    icon: ">",
    heroTagline: "Weston Rd / York visit notes",
    banner: "/banners/p60-real/page-near-toronto.webp",
    sections: [
      {
        heading: "Use The York Store Page First",
        body: "P60 Cannabis is a York store at 1938 Weston Rd. If you are comparing weed stores near Toronto or West Toronto, confirm the store page, directions, contact options, and listed hours before visiting.",
      },
      {
        heading: "Choose The Product Category",
        body: "Use the category that matches the visit: flower tiers, pre-rolls, edibles, THC vapes, concentrates, cigarettes, or accessories. Current product details belong in the menu, not in old examples.",
      },
      {
        heading: "Plan Around Current Details",
        body: "For product names, posted prices, and selection, use the current menu or ask staff. This page is for orientation and local visit planning.",
      },
    ],
    faqs: [
      { q: "Is P60 Cannabis near Toronto?", a: "P60 Cannabis is located in York at 1938 Weston Rd. Use the store page for directions from your starting point." },
      { q: "Can shoppers browse before visiting?", a: "Yes. Use the current menu and category pages before heading to the store." },
      { q: "How do I check current product listings?", a: "Check the current menu or ask staff for today's product details." },
    ],
  },
  {
    slug: "dispensary-near-me-york",
    title: "Cannabis Dispensary Near Me York - P60 Cannabis",
    metaDescription: "Use P60 Cannabis when searching for a cannabis dispensary near me in York; compare menu categories and confirm current details before visiting.",
    h1: "Cannabis Dispensary Near Me - York",
    icon: "o",
    heroTagline: "Store page first, category second",
    banner: "/banners/p60-real/page-near-me.webp",
    sections: [
      {
        heading: "Make The Near-Me Search Useful",
        body: "A near-me search should get you to the right store page and the best category. P60 Cannabis gives York shoppers a path to store details, menu categories, and resources.",
      },
      {
        heading: "Compare Categories Clearly",
        body: "Use normal shopping language: cannabis dispensary in York, weed dispensary on Weston Rd, cheap weed, budget flower, premium flower, pre-rolls, edibles, THC vapes, and concentrates.",
      },
      {
        heading: "Check Current Details",
        body: "For product names, prices, and selection, use the current menu or ask staff. This page is for orientation and visit planning.",
      },
    ],
    faqs: [
      { q: "Is P60 Cannabis useful for a near-me search in York?", a: "Yes. Start with the P60 Cannabis store page, then open the menu category that matches the visit." },
      { q: "What categories can shoppers compare?", a: "Use the menu sections for flower, pre-rolls, edibles, THC vapes, concentrates, accessories, and cigarettes where listed." },
      { q: "Where is P60 Cannabis located?", a: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." },
    ],
  },
  {
    slug: "nicotine-vapes-york",
    title: "Nicotine Vapes in York | P60 Cannabis",
    absoluteTitle: true,
    metaDescription: "Adults 19+: review six nicotine vape product pages from P60 Cannabis in York, then check /items/vapes for the current category. Nicotine is addictive.",
    h1: "Nicotine Vapes at P60 Cannabis in York",
    icon: "NV",
    heroTagline: "Adults 19+ · Nicotine is addictive.",
    heroPreview: {
      eyebrow: "P60 CANNABIS • WESTON ROAD / YORK • ADULTS 19+",
      intro: "Searching for nicotine vapes near me around Weston Road or York? This adult-only P60 Cannabis guide features six live-checked VAPE PENS product pages. Compare their supported names, then use /items/vapes for the current nicotine category. Product details can change. Nicotine is addictive.",
      products: [
        { name: "GEEK PROMAX – 5% | 30K PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/GEEK-PROMAX.jpg", sourceSlug: "geek-promax-5-30k-puffs" },
        { name: "GEEK UNIVERSE 25k PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/geek_universe_pulse_x_25k.webp", sourceSlug: "geek-universe-25k-puffs" },
        { name: "NEXA PIX | 30K PUFFS | MANY FLAVORS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/nexa_showcase_600x600.webp", sourceSlug: "nexa-pix-30k-puffs-many-flavors" },
        { name: "OVNS 10000 – 5% | 10K PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/1081OVNS10000.jpg", sourceSlug: "ovns-10000-5-10k-puffs" },
        { name: "OVNS DISPOSABLE – 5% | 8ML | MANY FLAVORS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/OVNS500x500HQ.webp", sourceSlug: "ovns-disposable-5-8ml-many-flavors" },
        { name: "OVNS PIONEER – 5% | 22K PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/OVNS_PIONEER_5_22K_PUFFS.webp", sourceSlug: "ovns-pioneer-5-22k-puffs" },
      ],
      disclosure: "Featured cards are live-checked starting points, not guarantees of current stock, price or availability.",
      theme: "nicotine",
      menuHref: "/items/vapes",
      primaryLabel: "Browse Nicotine Vapes",
      secondaryLabel: "Compare the Six Featured Items",
      secondaryHref: "#featured-vapes",
      identityStrip: "P60 Cannabis | Weston Road / York | Adults 19+ | Nicotine is addictive.",
      featuredHeading: "Six Live-Checked P60 Cannabis Vape Cards",
      featuredIntro: "This shortlist contains six live-checked Geek, NEXA and OVNS VAPE PENS product pages. Use each card for its supported display name, then rely on /items/vapes for the current P60 Cannabis category listing.",
      warning: "Adults 19+. Nicotine is addictive.",
    },
    sections: [
      { heading: "Read Each Product Format Carefully", body: "One featured page explicitly identifies an OVNS disposable. Keep that description attached only to that product and do not apply the disposable label to another featured item by assumption." },
      { heading: "Puff Counts Identify Listings", body: "Several featured names include puff counts. Use those numbers to distinguish the listings, not as guarantees of duration, performance or superiority." },
      { heading: "Keep Nicotine and Cannabis Vape Routes Separate", body: "This adult-only P60 Cannabis guide uses VAPE PENS products under /items/vapes. THC and cannabis vape products under /items/vape-disposables are excluded." },
      { heading: "Review the Current York Category", body: "Before choosing, open /items/vapes and the individual product page for current supported details. This guide does not claim prices, stock or guaranteed availability." },
    ],
    faqs: [
      { q: "Where should I check P60 Cannabis’s current nicotine selection?", a: "Use /items/vapes. The six featured cards are live-checked starting points while the current category listing controls selection information." },
      { q: "Does every featured item use the same format?", a: "No format should be assumed. One featured page explicitly identifies an OVNS disposable. Read each current product page for its supported format and details." },
      { q: "Does this page include cannabis vapes?", a: "No. It covers nicotine products from the VAPE PENS category for adults 19+. THC and cannabis vape products under /items/vape-disposables are excluded." },
    ],
  },
];

export function getSeoPageBySlug(slug: string): SeoPageData | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}
