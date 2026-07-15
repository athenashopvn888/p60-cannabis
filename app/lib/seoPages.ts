export interface SeoPageData {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  icon: string;
  heroTagline: string;
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
    heroTagline: "1938 Weston Rd in York - open daily 10:00 AM to 03:00 AM",
    banner: "/banners/p60-real/page-york.webp",
    sections: [
      {
        heading: "Visit P60 Cannabis On Weston Rd",
        body: "P60 Cannabis is located at 1938 Weston Rd in York. Use this page for the basic store context, then use the current menu or staff for product names, posted prices, and availability details that can change.",
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
      { q: "What are the listed hours for P60 Cannabis?", a: "The site lists P60 Cannabis as open daily from 10:00 AM to 03:00 AM." },
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
        body: "Use the current product name, format, size, posted price, and item notes when comparing value options. Menus can change, so this page is a shopping guide rather than a promise of live availability.",
      },
      {
        heading: "Move Up Only If It Fits The Visit",
        body: "If Budget or AA does not fit the visit, compare AAA+, Premium, or Exotic next. The better decision starts with the category, then the current item details.",
      },
    ],
    faqs: [
      { q: "Where should value shoppers start at P60 Cannabis?", a: "Start with Budget and AA flower, then compare the current menu details." },
      { q: "Does this page guarantee current prices?", a: "No. Use the current menu or ask staff for product, price, and availability details." },
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
      { q: "Are cigarette prices current on this page?", a: "Confirm current prices and availability with the menu or staff." },
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
        body: "For product names, posted prices, and availability, use the current menu or ask staff. This page is for orientation and local visit planning.",
      },
    ],
    faqs: [
      { q: "Is P60 Cannabis near Toronto?", a: "P60 Cannabis is located in York at 1938 Weston Rd. Use the store page for directions from your starting point." },
      { q: "Can shoppers browse before visiting?", a: "Yes. Use the current menu and category pages before heading to the store." },
      { q: "Does this page list live inventory?", a: "No. Check the current menu or ask staff for live product details." },
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
        body: "For product names, prices, and availability, use the current menu or ask staff. This page is for orientation and visit planning.",
      },
    ],
    faqs: [
      { q: "Is P60 Cannabis useful for a near-me search in York?", a: "Yes. Start with the P60 Cannabis store page, then open the menu category that matches the visit." },
      { q: "What categories can shoppers compare?", a: "Use the menu sections for flower, pre-rolls, edibles, THC vapes, concentrates, accessories, and cigarettes where listed." },
      { q: "Where is P60 Cannabis located?", a: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." },
    ],
  },
];

export function getSeoPageBySlug(slug: string): SeoPageData | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}
