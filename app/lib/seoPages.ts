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
    slug: "native-cigarettes-york",
    title: "Native Cigarettes York",
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
      { q: "How can shoppers confirm current cigarette prices?", a: "Confirm current prices and selection with the menu or staff." },
      { q: "Where is the store?", a: "P60 Cannabis is at 1938 Weston Rd, York, ON M9N 1W2." },
    ],
  },
  {
    slug: "weed-store-near-toronto",
    title: "Visiting P60 Cannabis from Toronto | York Store Information",
    absoluteTitle: true,
    metaDescription: "Coming from Toronto? P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2 and is open 24 hours. View our York store information before visiting.",
    h1: "Visiting P60 Cannabis from Toronto",
    icon: ">",
    heroTagline: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2 and is open 24 hours.",
    banner: "/banners/p60-real/page-near-toronto.webp",
    sections: [
      {
        heading: "P60 Cannabis Store Address",
        body: "Use the following address when planning your visit: P60 Cannabis, 1938 Weston Rd, York, ON M9N 1W2. Hours: Open 24 hours. Phone: (289) 217-2763.",
      },
      {
        heading: "Before You Visit",
        body: "P60 Cannabis is open 24 hours at its Weston Road location in York. If you need to contact the store before visiting, call (289) 217-2763. For the full York store page, continue to P60 Cannabis York Store Information.",
      },
    ],
    faqs: [
      { q: "What address should I use for P60 Cannabis?", a: "Use 1938 Weston Rd, York, ON M9N 1W2." },
      { q: "What are the store hours?", a: "P60 Cannabis is open 24 hours." },
      { q: "What is the P60 Cannabis phone number?", a: "The store phone number is (289) 217-2763." },
      { q: "Where can I find the complete York store information?", a: "Visit the dedicated P60 Cannabis York store page." },
    ],
  },
  {
    slug: "nicotine-vapes-york",
    title: "Nicotine Vapes in York | P60 Cannabis",
    absoluteTitle: true,
    metaDescription: "Adults 19+: review six nicotine vape product pages from P60 Cannabis in York, then check the current Nicotine Vape category. Nicotine is addictive.",
    h1: "Nicotine Vapes at P60 Cannabis in York",
    icon: "NV",
    heroTagline: "Adults 19+ · Nicotine is addictive.",
    heroPreview: {
      eyebrow: "P60 CANNABIS • WESTON ROAD / YORK • ADULTS 19+",
      intro: "Searching for nicotine vapes near me around Weston Road or York? This adult-only P60 Cannabis guide features six VAPE PENS product pages. Compare their supported names, then use the current Nicotine Vape menu. Product details can change. Nicotine is addictive.",
      products: [
        { name: "GEEK PROMAX – 5% | 30K PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/GEEK-PROMAX.jpg", sourceSlug: "geek-promax-5-30k-puffs" },
        { name: "GEEK UNIVERSE 25k PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/geek_universe_pulse_x_25k.webp", sourceSlug: "geek-universe-25k-puffs" },
        { name: "NEXA PIX | 30K PUFFS | MANY FLAVORS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/nexa_showcase_600x600.webp", sourceSlug: "nexa-pix-30k-puffs-many-flavors" },
        { name: "OVNS 10000 – 5% | 10K PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/1081OVNS10000.jpg", sourceSlug: "ovns-10000-5-10k-puffs" },
        { name: "OVNS DISPOSABLE – 5% | 8ML | MANY FLAVORS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/OVNS500x500HQ.webp", sourceSlug: "ovns-disposable-5-8ml-many-flavors" },
        { name: "OVNS PIONEER – 5% | 22K PUFFS", image: "https://pub-eb3e1fe18a43477eabc885cfb791d97c.r2.dev/products/OVNS_PIONEER_5_22K_PUFFS.webp", sourceSlug: "ovns-pioneer-5-22k-puffs" },
      ],
      disclosure: "Featured cards are starting points, not guarantees of current stock, price or availability.",
      theme: "nicotine",
      menuHref: "/items/vapes",
      primaryLabel: "Browse Nicotine Vapes",
      secondaryLabel: "Compare the Six Featured Items",
      secondaryHref: "#featured-vapes",
      identityStrip: "P60 Cannabis | Weston Road / York | Adults 19+ | Nicotine is addictive.",
      featuredHeading: "Six P60 Cannabis Nicotine Vape Cards",
      featuredIntro: "This shortlist contains six Geek, NEXA and OVNS VAPE PENS product pages. Use each card for its supported display name, then rely on the current Nicotine Vape menu.",
      warning: "Adults 19+. Nicotine is addictive.",
    },
    sections: [
      { heading: "Read Each Product Format Carefully", body: "One featured page explicitly identifies an OVNS disposable. Keep that description attached only to that product and do not apply the disposable label to another featured item by assumption." },
      { heading: "Puff Counts Identify Listings", body: "Several featured names include puff counts. Use those numbers to distinguish the listings, not as guarantees of duration, performance or superiority." },
      { heading: "Keep Nicotine and Cannabis Vape Routes Separate", body: "This adult-only P60 Cannabis guide uses Nicotine Vape products. THC and cannabis vape products remain separate in the THC Vape category." },
      { heading: "Review the Current York Category", body: "Before choosing, open the Nicotine Vape menu and the individual product page for current supported details. This guide does not claim prices, stock or guaranteed availability." },
    ],
    faqs: [
      { q: "Where should I check P60 Cannabis’s current nicotine selection?", a: "Use the current Nicotine Vape menu. The six featured cards are starting points while the current category listing controls selection information." },
      { q: "Does every featured item use the same format?", a: "No format should be assumed. One featured page explicitly identifies an OVNS disposable. Read each current product page for its supported format and details." },
      { q: "Does this guide include cannabis vapes?", a: "No. It covers nicotine products from the VAPE PENS category for adults 19+. THC and cannabis vape products belong to the separate THC Vape category." },
    ],
  },
];

export function getSeoPageBySlug(slug: string): SeoPageData | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}
