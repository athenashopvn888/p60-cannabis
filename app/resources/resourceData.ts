export type ResourceAuthorKey = "riley" | "mina" | "team";

export interface ResourceAuthor {
  name: string;
  handle: string;
  role: string;
}

export interface ResourceLink {
  label: string;
  href: string;
  description?: string;
}

export interface ResourceSection {
  heading: string;
  body: string[];
  bullets?: string[];
  links?: ResourceLink[];
}

export interface ResourcePage {
  path: string;
  kind: "root" | "category" | "article" | "update";
  parent?: string;
  categoryLabel: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  excerpt: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  searchIntent: string;
  author: ResourceAuthorKey;
  datePublished: string;
  dateModified: string;
  image: {
    src: string;
    alt: string;
  };
  intro: string[];
  sections: ResourceSection[];
  commercialLinks: ResourceLink[];
  related: string[];
  secondTake?: {
    author: ResourceAuthorKey;
    body: string;
  };
}

export const SITE = {
  name: "P60 Cannabis",
  domain: "p60cannabis.com",
  baseUrl: "https://p60cannabis.com",
  storePage: "/weed-dispensary-york",
  address: "1938 Weston Rd, York, ON M9N 1W2",
  phone: "(437) 522-2802",
  hours: "Open Daily: 10:00 AM - 03:00 AM",
};

export const AUTHORS: Record<ResourceAuthorKey, ResourceAuthor> = {
  riley: {
    name: "Riley Weston",
    handle: "@RileyWestonP60",
    role: "Resource Editor",
  },
  mina: {
    name: "Mina York",
    handle: "@MinaAtP60",
    role: "Resource Editor",
  },
  team: {
    name: "P60 Cannabis Team",
    handle: "@P60CannabisTeam",
    role: "Official Store Team",
  },
};

const updated = "2026-07-11";

const nativeCigaretteCartonLines = [
  "Rolled Gold Lights",
  "Canadian Full",
  "Canadian Lights",
  "Canadian Menthol",
  "Canadian Classics Original",
  "Canadian Classics Silver",
  "Canadian Goose Full",
  "Canadian Goose Lights",
  "Nexus Full",
  "Nexus Lights",
  "Putters",
  "Time Full",
];

const nativeCigaretteBrandFamilies = [
  "Rolled Gold",
  "Canadian",
  "Canadian Classics",
  "Canadian Goose",
  "Nexus",
  "Putters",
  "Time",
];

export const CATEGORY_PATHS = [
  "/resources/cannabis-101",
  "/resources/flower-guides",
  "/resources/pre-roll-guides",
  "/resources/edibles-guides",
  "/resources/vape-guides",
  "/resources/value-guides",
  "/resources/local-guides",
  "/resources/store-updates",
  "/resources/native-smokes",
  "/resources/magic-mushroom-guides",
];

export const RESOURCE_PAGES: ResourcePage[] = [
  {
    path: "/resources",
    kind: "root",
    categoryLabel: "Resource Centre",
    title: "P60 Cannabis Resource Centre",
    seoTitle: "Cannabis Resource Centre | P60 Cannabis",
    metaDescription:
      "Explore P60 Cannabis resources for flower, pre-rolls, edibles, THC vapes, value shopping, cigarettes, specialty products, and York store information.",
    h1: "P60 Cannabis Resource Centre",
    excerpt:
      "A cleaner way for adults 19+ to read the menu, compare categories, and move toward the right live P60 Cannabis page.",
    primaryKeyword: "P60 Cannabis resources",
    supportingKeywords: [
      "cannabis guides York",
      "P60 Cannabis menu guide",
      "native cigarettes York",
      "magic mushroom menu York",
    ],
    searchIntent: "Find organized P60 Cannabis shopping and menu guides.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/blog_banner.webp",
      alt: "P60 Cannabis Resource Centre guides",
    },
    intro: [
      "The P60 Cannabis Resource Centre brings the useful stuff into one clean place: flower, pre-rolls, edibles, THC vapes, value comparisons, cigarettes, specialty items, and local York store information.",
      "These pages help adults 19+ shop the current menu with sharper eyes. Product names, prices, weights, and availability can move, so the live menu and store staff stay the source for current details.",
    ],
    sections: [
      {
        heading: "Start With the Topic That Matches the Visit",
        body: [
          "Use the category hubs when you want the fast lane. Flower shoppers can jump into tier guides, edible shoppers can check label-reading basics, and value hunters can compare price with weight before getting pulled in by one loud number.",
        ],
      },
      {
        heading: "Current Menu Details Stay Current",
        body: [
          "Resources explain how to shop. The live menu shows what is listed now. When one product, price, weight, or hour decides the trip, check the current page or call the store before moving.",
        ],
      },
    ],
    commercialLinks: [
      { label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" },
      { label: "Browse Exotic flower", href: "/exotic" },
      { label: "Browse Budget flower", href: "/budget" },
      { label: "Explore current edibles", href: "/items/edibles" },
    ],
    related: [
      "/resources/cannabis-101/how-to-read-a-cannabis-menu",
      "/resources/value-guides/how-to-compare-flower-prices",
      "/resources/local-guides/weed-dispensary-in-york",
    ],
  },
  {
    path: "/resources/cannabis-101",
    kind: "category",
    categoryLabel: "Cannabis 101",
    title: "Cannabis 101 Guides",
    seoTitle: "Cannabis 101 Guides | P60 Cannabis",
    metaDescription:
      "Cannabis 101 resources from P60 Cannabis explain menu categories, product formats, listing details, and smarter ways to browse current information.",
    h1: "Cannabis 101: Read the Menu Before the Hype",
    excerpt:
      "Begin with format, listing details, and the live category page instead of guessing from product names alone.",
    primaryKeyword: "cannabis 101 guide",
    supportingKeywords: [
      "cannabis menu guide",
      "cannabis product formats",
      "beginner cannabis information York",
    ],
    searchIntent: "Learn basic menu and product-format browsing.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/blog_banner.webp",
      alt: "Cannabis 101 guide at P60 Cannabis",
    },
    intro: [
      "A good cannabis 101 guide should make the menu feel easier, not more precious. At P60 Cannabis, the clean starting point is format first: flower, pre-rolls, edibles, THC vapes, concentrates, cigarettes, accessories, or specialty items.",
    ],
    sections: [
      {
        heading: "Begin With Product Format",
        body: [
          "A flower listing and an edible listing do not ask the same questions. Once the format is clear, the right details become easier to compare.",
        ],
      },
      {
        heading: "Use the Current Page for Current Answers",
        body: [
          "Resource pages explain how to shop the menu. The live category page answers what is listed now.",
        ],
        links: [
          { label: "Read the cannabis menu guide", href: "/resources/cannabis-101/how-to-read-a-cannabis-menu" },
          { label: "Open the P60 Cannabis store page", href: "/weed-dispensary-york" },
        ],
      },
    ],
    commercialLinks: [
      { label: "View store details", href: "/weed-dispensary-york" },
      { label: "Open the FAQ", href: "/faq" },
    ],
    related: [
      "/resources/flower-guides",
      "/resources/pre-roll-guides",
      "/resources/edibles-guides",
    ],
  },
  {
    path: "/resources/flower-guides",
    kind: "category",
    categoryLabel: "Flower Guides",
    title: "Cannabis Flower Guides",
    seoTitle: "Cannabis Flower Guides | P60 Cannabis",
    metaDescription:
      "Explore P60 Cannabis flower guides covering Budget, AA, AAA+, Premium, Exotic, value comparisons, weights, and current menu listings.",
    h1: "Flower Guides: Know the Section Before Comparing Strains",
    excerpt:
      "P60 flower sections help you pick a lane before the product cards do the talking.",
    primaryKeyword: "cannabis flower guides York",
    supportingKeywords: [
      "AA vs AAA+ flower",
      "premium flower guide",
      "exotic flower guide",
      "Budget flower York",
    ],
    searchIntent: "Understand P60 flower tiers and flower comparisons.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/exotics_banner.webp",
      alt: "P60 Cannabis flower guide for Exotic and premium sections",
    },
    intro: [
      "P60 Cannabis organizes flower into Budget, AA, AAA+, Premium, and Exotic. Those labels are useful shopping lanes, not magic words. The current product card still matters.",
    ],
    sections: [
      {
        heading: "The Section Narrows the Shelf",
        body: [
          "Budget, AA, AAA+, Premium, and Exotic help shoppers move faster. After that, compare the actual listing: product name, weight, posted price, type, and item notes.",
        ],
      },
      {
        heading: "Flower Guides in This Lane",
        body: [
          "Start with the tier guide if you want the big map. Use the Budget vs Premium guide when you are deciding between value-first and higher-shelf browsing.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse Budget flower", href: "/budget" },
      { label: "Browse AA flower", href: "/aa" },
      { label: "Browse AAA+ flower", href: "/aaa" },
      { label: "Browse Premium flower", href: "/premium" },
      { label: "Browse Exotic flower", href: "/exotic" },
    ],
    related: [
      "/resources/value-guides",
      "/resources/cannabis-101/how-to-read-a-cannabis-menu",
    ],
  },
  {
    path: "/resources/pre-roll-guides",
    kind: "category",
    categoryLabel: "Pre-Roll Guides",
    title: "Pre-Roll Guides",
    seoTitle: "Pre-Roll Guides | P60 Cannabis",
    metaDescription:
      "P60 Cannabis pre-roll guides explain pre-rolls, flower comparisons, pack details, current listings, and practical menu browsing.",
    h1: "Pre-Roll Guides: Convenience Still Has Details",
    excerpt:
      "Pre-rolls are easy to grab, but pack count, format, and current notes still matter.",
    primaryKeyword: "pre-roll guide York",
    supportingKeywords: ["pre-rolls vs flower", "cannabis pre-roll menu", "pre-roll packs"],
    searchIntent: "Compare pre-roll format details before browsing.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/04_Pre_Rolls.webp",
      alt: "P60 Cannabis pre-roll guide",
    },
    intro: [
      "Pre-rolls win on convenience. That does not mean every listing is the same. Pack count, product notes, and whether an item is standard or infused can change the read.",
    ],
    sections: [
      {
        heading: "Check the Listing Before You Coast",
        body: [
          "Pre-roll shoppers should still check format, pack information, strain or product name, and current category details before planning the visit around one item.",
        ],
      },
      {
        heading: "Current Pre-Roll Category",
        body: ["Use the live category for current names, pack information, prices, and availability."],
        links: [{ label: "Browse current pre-rolls", href: "/items/prerolls" }],
      },
    ],
    commercialLinks: [{ label: "Browse current pre-rolls", href: "/items/prerolls" }],
    related: ["/resources/flower-guides", "/resources/cannabis-101"],
  },
  {
    path: "/resources/edibles-guides",
    kind: "category",
    categoryLabel: "Edibles Guides",
    title: "Cannabis Edibles Guides",
    seoTitle: "Cannabis Edibles Guides | P60 Cannabis",
    metaDescription:
      "Read P60 Cannabis edible guides covering delayed onset, product labels, serving information, current menu details, and careful browsing.",
    h1: "Edibles Guides: Read the Label Before the Flex",
    excerpt:
      "Edibles need a slower read than flower, pre-rolls, or THC vapes.",
    primaryKeyword: "cannabis edibles guide York",
    supportingKeywords: ["how long do edibles take", "edible cannabis menu", "edible label guide"],
    searchIntent: "Understand edible menu and package information.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/edibles_prerolls_more_banner.webp",
      alt: "P60 Cannabis edibles guide",
    },
    intro: [
      "Cannabis edibles are a different format with a different timeline. This lane is about label reading, package details, serving information where shown, and checking the current edible category before choosing.",
    ],
    sections: [
      {
        heading: "Edibles Do Not Shop Like Flower",
        body: [
          "Product type, package information, listed amount, and serving details should be read together. Do not treat every edible as interchangeable because the front label looks loud.",
        ],
      },
      {
        heading: "Current Edible Category",
        body: ["Use the live page for current edible listings and package details."],
        links: [{ label: "Explore current edibles", href: "/items/edibles" }],
      },
    ],
    commercialLinks: [{ label: "Explore current edibles", href: "/items/edibles" }],
    related: ["/resources/cannabis-101", "/resources/vape-guides"],
  },
  {
    path: "/resources/vape-guides",
    kind: "category",
    categoryLabel: "Vape Guides",
    title: "THC Vape Guides",
    seoTitle: "THC Vape Guides | P60 Cannabis",
    metaDescription:
      "P60 Cannabis THC vape guides explain format differences, disposable and cartridge details, compatibility questions, and current menu checks.",
    h1: "THC Vape Guides: Format First, Then the Listing",
    excerpt:
      "Vape shopping starts with the format: cartridge, disposable, or another listed type.",
    primaryKeyword: "THC vape guide York",
    supportingKeywords: ["THC vapes vs flower", "disposable THC vapes", "vape cartridge guide"],
    searchIntent: "Compare THC vape formats and current listings.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/01_Vape_Pens.webp",
      alt: "P60 Cannabis THC vape guide",
    },
    intro: [
      "THC vapes have their own menu logic. The first question is usually the format, then compatibility, product notes, and current listing details.",
    ],
    sections: [
      {
        heading: "Separate THC Vape Questions From Nicotine Vape Questions",
        body: [
          "This section focuses on cannabis vape shopping, not nicotine products. Format and compatibility matter before brand names start doing all the talking.",
        ],
      },
      {
        heading: "Current Vape Categories",
        body: ["Check the live pages when a specific vape item matters."],
        links: [
          { label: "Browse THC vapes", href: "/items/vapes" },
          { label: "Browse vape disposables", href: "/items/vape-disposables" },
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse THC vapes", href: "/items/vapes" },
      { label: "Browse vape disposables", href: "/items/vape-disposables" },
    ],
    related: ["/resources/flower-guides", "/resources/edibles-guides"],
  },
  {
    path: "/resources/value-guides",
    kind: "category",
    categoryLabel: "Value Guides",
    title: "Value and Budget Cannabis Guides",
    seoTitle: "Cheap Weed and Value Guides | P60 Cannabis",
    metaDescription:
      "P60 Cannabis value guides help York shoppers compare flower prices, weights, Budget sections, and current listings more clearly.",
    h1: "Value Guides: Cheap Weed Still Needs Smart Math",
    excerpt:
      "If the price looks good, read the weight beside it. That is where the real comparison starts.",
    primaryKeyword: "cheap weed York",
    supportingKeywords: [
      "affordable weed York",
      "Budget flower York",
      "compare cannabis prices",
      "flower price by weight",
    ],
    searchIntent: "Compare value, price, and weight before shopping.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/budget_banner.webp",
      alt: "P60 Cannabis value and budget flower guide",
    },
    intro: [
      "Cheap weed, budget weed, affordable flower - shoppers use those words because the price matters. The smart move is reading price and weight together before calling anything a win.",
    ],
    sections: [
      {
        heading: "Cheap Weed Value Is More Than One Number",
        body: [
          "A useful comparison includes weight, current price, flower section, and product notes. One low number without context can trick the eye.",
        ],
      },
      {
        heading: "Useful Flower Paths",
        body: ["Start with the live P60 flower lanes when value is the mission."],
        links: [
          { label: "Browse Budget flower", href: "/budget" },
          { label: "Browse AA flower", href: "/aa" },
          { label: "Browse AAA+ flower", href: "/aaa" },
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse Budget flower", href: "/budget" },
      { label: "Browse AA flower", href: "/aa" },
      { label: "Browse AAA+ flower", href: "/aaa" },
    ],
    related: ["/resources/flower-guides", "/resources/flower-guides/budget-vs-premium-flower"],
  },
  {
    path: "/resources/local-guides",
    kind: "category",
    categoryLabel: "Local Guides",
    title: "York Cannabis Store Guides",
    seoTitle: "York Cannabis Store Guides | P60 Cannabis",
    metaDescription:
      "Local York and Weston Road guides for P60 Cannabis, including store location, menu planning, nearby area context, and current visit information.",
    h1: "York and Weston Road Local Guides",
    excerpt:
      "Local pages should help shoppers land on the right store, the right route, and the right menu category.",
    primaryKeyword: "weed dispensary York",
    supportingKeywords: [
      "cannabis store near Weston Road",
      "York cannabis store",
      "cannabis dispensary Mount Dennis",
    ],
    searchIntent: "Find P60 Cannabis local visit and store information.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/welcome_banner.webp",
      alt: "P60 Cannabis York store guide",
    },
    intro: [
      "P60 Cannabis is listed at 1938 Weston Rd in York. The local guide lane keeps the visit simple: confirm the store page, choose the matching category, and check current details before travelling for one exact item.",
    ],
    sections: [
      {
        heading: "Use the Exact Weed Dispensary York Store Page",
        body: [
          "Broad searches can bring back messy results. The P60 Cannabis store page is the clean starting point for address, phone, hours, and visit planning.",
        ],
        links: [{ label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" }],
      },
      {
        heading: "Move From Location to Menu",
        body: [
          "Once the store is confirmed, jump into the category that matches the visit: flower, pre-rolls, edibles, THC vapes, concentrates, cigarettes, accessories, or specialty items.",
        ],
      },
    ],
    commercialLinks: [
      { label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" },
      { label: "Open the FAQ", href: "/faq" },
    ],
    related: ["/resources/cannabis-101", "/resources/value-guides"],
  },
  {
    path: "/resources/store-updates",
    kind: "category",
    categoryLabel: "Store Updates",
    title: "P60 Cannabis Store Updates",
    seoTitle: "Store Updates | P60 Cannabis",
    metaDescription:
      "Read verified P60 Cannabis updates about resources, store information, services, menu changes, and important York announcements.",
    h1: "P60 Cannabis Store Updates",
    excerpt:
      "Official updates live here when something verified changes or a permanent resource goes live.",
    primaryKeyword: "P60 Cannabis updates",
    supportingKeywords: ["P60 Cannabis hours", "P60 Cannabis news", "store announcements York"],
    searchIntent: "Find official P60 Cannabis announcements.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/homepage_hero.webp",
      alt: "P60 Cannabis official store updates",
    },
    intro: [
      "This lane is for official P60 Cannabis updates. It is not a dumping ground for filler posts. Updates belong here when something verified needs a clean public home.",
    ],
    sections: [
      {
        heading: "What Belongs in Store Updates",
        body: [
          "Resource launches, store information changes, service updates, menu navigation changes, closures, holiday notes, and other verified store announcements can live here.",
        ],
      },
      {
        heading: "Current Update",
        body: ["The first update announces the P60 Cannabis Resource Centre after the section is built and verified."],
        links: [{ label: "Read the Resource Centre launch update", href: "/resources/store-updates/resource-centre-launch" }],
      },
    ],
    commercialLinks: [{ label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" }],
    related: ["/resources", "/resources/local-guides"],
  },
  {
    path: "/resources/native-smokes",
    kind: "category",
    categoryLabel: "Native Smokes",
    title: "Native Smokes and Cigarette Guides",
    seoTitle: "Native Smokes and Cigarette Guides | P60 Cannabis",
    metaDescription:
      "P60 Cannabis native cigarette guides covering cheap native cigarettes at $25 per carton, brand names, packs, cartons, and current York store details.",
    h1: "Native Smokes: Cheap Native Cigarettes at $25 Per Carton",
    excerpt:
      "For adults 19+, this lane introduces the current P60 native cigarette carton brands and keeps pack/carton terms clear.",
    primaryKeyword: "native cigarettes York",
    supportingKeywords: [
      "cheap native cigarettes York",
      "native smokes York",
      "native cigarettes Weston Road",
      "cigarette packs and cartons",
    ],
    searchIntent: "Understand native cigarette menu and package terms.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/06_Cigarettes.webp",
      alt: "P60 Cannabis native cigarette guide",
    },
    intro: [
      "Native smokes and native cigarettes are common shopper phrases. P60 Cannabis currently has cheap native cigarette carton options listed at $25 per carton, with public-menu brand families including Rolled Gold, Canadian, Canadian Classics, Canadian Goose, Nexus, Putters, and Time.",
      "This section introduces the available carton names, explains pack and carton terminology, and points adults 19+ back to the live cigarette category before they visit.",
    ],
    sections: [
      {
        heading: "Cheap Native Cigarettes at $25 Per Carton",
        body: [
          "Inventory checked from the public P60 cigarette menu on July 11, 2026. The current native cigarette carton lane is built around $25 per carton options, with these brand families available in the resource list:",
        ],
        bullets: nativeCigaretteBrandFamilies,
      },
      {
        heading: "Current $25 Carton Lineup",
        body: [
          "The available carton names include full, lights, menthol, original, silver, and ultra-light options depending on the brand. Check the live cigarette page before visiting because tobacco selection can rotate.",
        ],
        bullets: nativeCigaretteCartonLines,
      },
      {
        heading: "Native Cigarettes Need Current Listing Checks",
        body: [
          "A static guide should not freeze a rotating shelf. It should tell adults 19+ what details to check before visiting for one specific cigarette product: brand, variety, pack or carton, and current posted price.",
        ],
      },
      {
        heading: "Tobacco Health Notice",
        body: [
          "Smoking and nicotine use carry serious health risks. These resources provide menu-navigation information only and do not make safety or health claims.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse current cigarettes", href: "/items/cigarettes" },
      { label: "Read the native cigarettes York page", href: "/info/native-cigarettes-york" },
    ],
    related: ["/resources/native-smokes/native-cigarettes-guide", "/resources/native-smokes/packs-vs-cartons"],
  },
  {
    path: "/resources/magic-mushroom-guides",
    kind: "category",
    categoryLabel: "Magic Mushroom Guides",
    title: "Magic Mushroom and Specialty-Product Guides",
    seoTitle: "Magic Mushroom Guides | P60 Cannabis",
    metaDescription:
      "P60 Cannabis specialty-product guides explain magic mushroom menu formats, package labels, listed amounts, and current Magic Stuff category checks.",
    h1: "Magic Mushroom Guides: Read the Format, Then the Label",
    excerpt:
      "Specialty menus can be loud. These guides keep the reading practical and adult 19+.",
    primaryKeyword: "magic mushroom guide York",
    supportingKeywords: [
      "magic mushroom menu York",
      "mushroom chocolate guide",
      "mushroom gummies guide",
      "Magic Stuff category",
    ],
    searchIntent: "Understand specialty-product menu formats and labels.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/09_Magic_Stuff.webp",
      alt: "P60 Cannabis Magic Stuff specialty-product guide",
    },
    intro: [
      "The P60 Magic Stuff lane is for specialty-product menu reading. These guides explain formats and labels only. They do not provide dosing, consumption, medical, therapeutic, or legal advice.",
    ],
    sections: [
      {
        heading: "Format Comes First",
        body: [
          "Dried products, chocolates, gummies, capsules, beverages, and other specialty items can use different package language. Read the format before comparing the number in the title.",
        ],
      },
      {
        heading: "Current Magic Stuff Category",
        body: ["Use the live category when availability, package details, or one exact product matters."],
        links: [{ label: "Browse current Magic Stuff", href: "/items/magic" }],
      },
    ],
    commercialLinks: [{ label: "Browse current Magic Stuff", href: "/items/magic" }],
    related: [
      "/resources/magic-mushroom-guides/magic-mushroom-formats-explained",
      "/resources/magic-mushroom-guides/how-to-read-a-magic-mushroom-menu",
    ],
  },
  {
    path: "/resources/cannabis-101/how-to-read-a-cannabis-menu",
    kind: "article",
    parent: "/resources/cannabis-101",
    categoryLabel: "Cannabis 101",
    title: "How to Read a Cannabis Menu Without Getting Lost",
    seoTitle: "How to Read a Cannabis Menu | P60 Cannabis",
    metaDescription:
      "Learn how to read a cannabis menu by starting with product format, current listings, flower tiers, item details, and P60 Cannabis category links.",
    h1: "How to Read a Cannabis Menu Without Getting Lost",
    excerpt:
      "A clean menu-reading system for adults 19+ who want fewer tabs, fewer guesses, and a better next click.",
    primaryKeyword: "how to read a cannabis menu",
    supportingKeywords: ["cannabis menu guide", "cannabis product categories", "P60 Cannabis menu"],
    searchIntent: "Learn practical cannabis menu navigation.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/blog_banner.webp",
      alt: "How to read a cannabis menu at P60 Cannabis",
    },
    intro: [
      "Learning how to read a cannabis menu is not about memorizing every strain name. It is about finding the right shelf fast, reading the listing completely, and knowing when the current menu or store staff should answer the final detail.",
    ],
    sections: [
      {
        heading: "Start With the Product Format",
        body: [
          "First, decide what kind of page you are actually shopping: flower, pre-rolls, edibles, THC vapes, concentrates, cigarettes, accessories, or specialty items. Format controls the details that matter.",
        ],
      },
      {
        heading: "Read the Complete Listing",
        body: [
          "A strong menu read includes the product name, section, type, weight or package size, posted price, and any item notes. Do not let one bold number do all the thinking.",
        ],
      },
      {
        heading: "Use Flower Tiers as Shopping Lanes",
        body: [
          "Budget, AA, AAA+, Premium, and Exotic narrow the shelf. Once you pick a lane, compare individual product cards inside that lane before jumping across the whole menu.",
        ],
        links: [
          { label: "Browse Budget flower", href: "/budget" },
          { label: "Browse Exotic flower", href: "/exotic" },
        ],
      },
      {
        heading: "Match Item Categories to the Visit",
        body: [
          "If the visit is about edibles, pre-rolls, THC vapes, concentrates, cigarettes, or Magic Stuff, use that category first. Category-first browsing saves time.",
        ],
      },
      {
        heading: "Confirm the Current Detail",
        body: [
          "A resource can teach the menu logic. It cannot promise current stock. When one exact item decides the trip, check the live page or call P60 Cannabis.",
        ],
      },
    ],
    commercialLinks: [
      { label: "View P60 Cannabis store details", href: "/weed-dispensary-york" },
      { label: "Browse current pre-rolls", href: "/items/prerolls" },
      { label: "Explore current edibles", href: "/items/edibles" },
    ],
    related: [
      "/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic",
      "/resources/value-guides/how-to-compare-flower-prices",
    ],
    secondTake: {
      author: "mina",
      body: "The easiest menu move is format first. Once the shelf is right, the product card has a real job instead of becoming one more tab in the pile.",
    },
  },
  {
    path: "/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic",
    kind: "article",
    parent: "/resources/flower-guides",
    categoryLabel: "Flower Guides",
    title: "AA vs AAA+ vs Premium vs Exotic Flower",
    seoTitle: "AA vs AAA+ vs Premium vs Exotic | P60 Cannabis",
    metaDescription:
      "Compare AA, AAA+, Premium, and Exotic flower sections at P60 Cannabis and learn how to use tiers without treating them as automatic guarantees.",
    h1: "AA vs AAA+ vs Premium vs Exotic: What the Flower Sections Do",
    excerpt:
      "The tier name gets you to the right shelf. The listing tells you what is actually sitting there today.",
    primaryKeyword: "AA vs AAA+ vs Premium vs Exotic",
    supportingKeywords: ["P60 flower tiers", "premium flower guide", "exotic flower guide"],
    searchIntent: "Compare P60 flower tier labels and shopping purpose.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/premium_banner.webp",
      alt: "AA vs AAA+ vs Premium vs Exotic flower guide at P60 Cannabis",
    },
    intro: [
      "AA vs AAA+ vs Premium vs Exotic is really a question about menu lanes. At P60 Cannabis, the tier helps shoppers decide where to begin before comparing current product cards.",
    ],
    sections: [
      {
        heading: "How Flower Sections Organize the Menu",
        body: [
          "Tier names help sort the menu by browsing style. They are useful because they reduce the first decision: value lane, daily-driver lane, stronger middle lane, premium lane, or exotic lane.",
        ],
      },
      {
        heading: "AA and AAA+ Keep the Comparison Grounded",
        body: [
          "AA and AAA+ are often where shoppers compare everyday value, current weight, and posted price with less drama. Read the live item card before making the call.",
        ],
        links: [
          { label: "Browse AA flower", href: "/aa" },
          { label: "Browse AAA+ flower", href: "/aaa" },
        ],
      },
      {
        heading: "Premium and Exotic Are Higher-Shelf Starting Points",
        body: [
          "Premium and Exotic can be the right lane when the shopper wants a higher-shelf browse. The tier still does not replace the current listing.",
        ],
        links: [
          { label: "Browse Premium flower", href: "/premium" },
          { label: "Browse Exotic flower", href: "/exotic" },
        ],
      },
      {
        heading: "Do Not Compare Labels Without Weights",
        body: [
          "A tier comparison gets sharper when weight, current price, and item notes are visible together. That is where the real menu read happens.",
        ],
      },
      {
        heading: "Let the Current Card Finish the Decision",
        body: [
          "Use the tier to enter the lane. Use the product card to compare what is actually listed now.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse AA flower", href: "/aa" },
      { label: "Browse AAA+ flower", href: "/aaa" },
      { label: "Browse Premium flower", href: "/premium" },
      { label: "Browse Exotic flower", href: "/exotic" },
    ],
    related: [
      "/resources/flower-guides/budget-vs-premium-flower",
      "/resources/value-guides/how-to-compare-flower-prices",
    ],
    secondTake: {
      author: "mina",
      body: "The tier gets attention, but the product card closes the gap. Price, weight, and current listing details are where the shopper actually wins.",
    },
  },
  {
    path: "/resources/flower-guides/budget-vs-premium-flower",
    kind: "article",
    parent: "/resources/flower-guides",
    categoryLabel: "Flower Guides",
    title: "Budget vs Premium Flower",
    seoTitle: "Budget vs Premium Flower | P60 Cannabis",
    metaDescription:
      "Compare Budget and Premium flower at P60 Cannabis by reading current price, weight, section, product notes, and the shopper goal behind each lane.",
    h1: "Budget vs Premium Flower: Pick the Lane Before the Strain",
    excerpt:
      "Budget and Premium are not enemies. They answer different shopping moods.",
    primaryKeyword: "Budget vs Premium flower",
    supportingKeywords: ["budget weed York", "premium flower York", "P60 Cannabis flower"],
    searchIntent: "Compare value-first and premium flower browsing.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/budget_banner.webp",
      alt: "Budget vs Premium flower guide at P60 Cannabis",
    },
    intro: [
      "Budget vs Premium flower is not a moral debate. It is a shopping decision. One lane leans value-first, the other leans higher-shelf browsing. Both still need the current listing.",
    ],
    sections: [
      {
        heading: "When Budget Is the Better Starting Point",
        body: [
          "Budget flower makes sense when the shopper is watching the total, comparing weights, or looking for a practical grab without making the menu too precious.",
        ],
        links: [{ label: "Browse Budget flower", href: "/budget" }],
      },
      {
        heading: "When Premium Gets the First Click",
        body: [
          "Premium flower is the lane for shoppers who want to browse higher-shelf options first. It still deserves the same comparison: weight, current price, type, and item notes.",
        ],
        links: [{ label: "Browse Premium flower", href: "/premium" }],
      },
      {
        heading: "Compare the Same Kind of Detail",
        body: [
          "The clean comparison is not just Budget price versus Premium price. Compare the listed amount, current posted price, product section, and what the item card actually says.",
        ],
      },
      {
        heading: "Use the Live Menu Before Calling It",
        body: [
          "Stock and pricing can shift. If one specific flower decides the visit, use the live P60 page first.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse Budget flower", href: "/budget" },
      { label: "Browse Premium flower", href: "/premium" },
      { label: "Browse Exotic flower", href: "/exotic" },
    ],
    related: [
      "/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic",
      "/resources/value-guides/how-to-compare-flower-prices",
    ],
    secondTake: {
      author: "riley",
      body: "Budget shoppers and premium shoppers can both be sharp. The difference is the lane they open first, not whether they care about the details.",
    },
  },
  {
    path: "/resources/pre-roll-guides/pre-rolls-vs-flower",
    kind: "article",
    parent: "/resources/pre-roll-guides",
    categoryLabel: "Pre-Roll Guides",
    title: "Pre-Rolls vs Flower",
    seoTitle: "Pre-Rolls vs Flower | P60 Cannabis",
    metaDescription:
      "Compare pre-rolls vs flower at P60 Cannabis by looking at convenience, control, pack details, current product notes, and the live menu.",
    h1: "Pre-Rolls vs Flower: Which Format Fits the Visit?",
    excerpt:
      "Pre-rolls bring convenience. Flower gives more control. The right pick depends on the job.",
    primaryKeyword: "pre-rolls vs flower",
    supportingKeywords: ["pre-roll guide York", "cannabis pre-roll menu", "flower vs pre-rolls"],
    searchIntent: "Compare pre-roll and flower shopping format differences.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/04_Pre_Rolls.webp",
      alt: "Pre-rolls vs flower guide at P60 Cannabis",
    },
    intro: [
      "Pre-rolls vs flower is a format question. One is already rolled and easy to grab. The other gives the shopper more control over amount, grind, and how the flower is used.",
    ],
    sections: [
      {
        heading: "Pre-Rolls Are Built for Convenience",
        body: [
          "Pre-rolls can make sense when speed and simplicity matter. Still read pack count, size, product name, and whether the listing has special notes.",
        ],
        links: [{ label: "Browse current pre-rolls", href: "/items/prerolls" }],
      },
      {
        heading: "Flower Gives More Control",
        body: [
          "Loose flower lets shoppers compare tiers and weights more directly. It also makes price-by-weight comparisons easier when the current listing is clear.",
        ],
        links: [{ label: "Browse current flower tiers", href: "/exotic" }],
      },
      {
        heading: "Do Not Compare Formats Like They Are Identical",
        body: [
          "A pre-roll pack and a flower listing may show different package details. Compare what each format actually includes before deciding which one fits.",
        ],
      },
      {
        heading: "Use Current Category Pages",
        body: [
          "When one exact item matters, confirm the live pre-roll page or the matching flower tier before visiting.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse current pre-rolls", href: "/items/prerolls" },
      { label: "Browse Exotic flower", href: "/exotic" },
      { label: "Browse Budget flower", href: "/budget" },
    ],
    related: [
      "/resources/flower-guides/budget-vs-premium-flower",
      "/resources/cannabis-101/how-to-read-a-cannabis-menu",
    ],
    secondTake: {
      author: "mina",
      body: "Convenience is real value when it matches the visit. Just do not let convenience skip the product details.",
    },
  },
  {
    path: "/resources/edibles-guides/how-long-do-edibles-take",
    kind: "article",
    parent: "/resources/edibles-guides",
    categoryLabel: "Edibles Guides",
    title: "How Long Do Edibles Take?",
    seoTitle: "How Long Do Edibles Take? | P60 Cannabis",
    metaDescription:
      "Learn why cannabis edibles can take longer than inhaled products, which label details to check, and how to use the current P60 edibles menu.",
    h1: "How Long Do Edibles Take?",
    excerpt:
      "Edibles are slower to read and slower to judge. Start with the package, not the guess.",
    primaryKeyword: "how long do edibles take",
    supportingKeywords: ["cannabis edibles guide York", "edible label guide", "P60 Cannabis edibles"],
    searchIntent: "Understand edible onset timing and label-reading basics.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/edibles_prerolls_more_banner.webp",
      alt: "How long do edibles take guide at P60 Cannabis",
    },
    intro: [
      "How long do edibles take? Longer than many shoppers expect. Edible cannabis is absorbed differently than inhaled cannabis, so the practical move is to read the package carefully and avoid rushing the decision.",
    ],
    sections: [
      {
        heading: "Edibles Can Have Delayed Onset",
        body: [
          "Edible cannabis can take a while before effects are noticeable, and package directions matter. This page is informational only and does not replace package instructions or health advice.",
        ],
      },
      {
        heading: "What to Check on an Edible Package",
        body: [
          "Read product type, listed THC amount, serving information where shown, package count, and any directions or warnings on the package.",
        ],
      },
      {
        heading: "Menu Titles Are Not the Whole Label",
        body: [
          "A product title may show a large number or flavour, but the package explains what that number means. Do not guess from the title alone.",
        ],
      },
      {
        heading: "Use the Current Edibles Page",
        body: [
          "The current P60 Cannabis edible category shows what is listed now. Check it before visiting for one specific edible.",
        ],
        links: [{ label: "Explore current edibles", href: "/items/edibles" }],
      },
    ],
    commercialLinks: [
      { label: "Explore current edibles", href: "/items/edibles" },
      { label: "Read the cannabis menu guide", href: "/resources/cannabis-101/how-to-read-a-cannabis-menu" },
    ],
    related: ["/resources/cannabis-101/how-to-read-a-cannabis-menu", "/resources/vape-guides/thc-vapes-vs-flower"],
    secondTake: {
      author: "team",
      body: "For edible questions, current package information is the authority. If the listing does not show enough detail, ask before buying.",
    },
  },
  {
    path: "/resources/vape-guides/thc-vapes-vs-flower",
    kind: "article",
    parent: "/resources/vape-guides",
    categoryLabel: "Vape Guides",
    title: "THC Vapes vs Flower",
    seoTitle: "THC Vapes vs Flower | P60 Cannabis",
    metaDescription:
      "Compare THC vapes vs flower by checking format, compatibility, package details, flower tiers, and current P60 Cannabis category listings.",
    h1: "THC Vapes vs Flower: What Changes With the Format?",
    excerpt:
      "Vapes and flower live in different menu lanes. Do not judge one with the other's rules.",
    primaryKeyword: "THC vapes vs flower",
    supportingKeywords: ["THC vape guide York", "vape cartridge guide", "P60 Cannabis vapes"],
    searchIntent: "Compare THC vape and flower format differences.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/01_Vape_Pens.webp",
      alt: "THC vapes vs flower guide at P60 Cannabis",
    },
    intro: [
      "THC vapes vs flower is not a winner-takes-all question. The formats ask shoppers to check different details before deciding which page fits the visit.",
    ],
    sections: [
      {
        heading: "Vape Format Comes First",
        body: [
          "For THC vapes, the first practical question is format: cartridge, disposable, or another listed type. Compatibility may matter when the product is not self-contained.",
        ],
        links: [
          { label: "Browse THC vapes", href: "/items/vapes" },
          { label: "Browse vape disposables", href: "/items/vape-disposables" },
        ],
      },
      {
        heading: "Flower Starts With Tier and Weight",
        body: [
          "Flower comparison usually starts with tier, weight, current price, and product notes. That is a different read from a vape listing.",
        ],
      },
      {
        heading: "Do Not Blend Nicotine and THC Categories",
        body: [
          "P60 menu categories separate product types. Make sure the page you are reading matches the product you actually want.",
        ],
      },
      {
        heading: "Confirm Current Details",
        body: [
          "Product formats, compatibility, and availability can change. Use the live category before planning around one exact vape item.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse THC vapes", href: "/items/vapes" },
      { label: "Browse vape disposables", href: "/items/vape-disposables" },
      { label: "Browse flower tiers", href: "/exotic" },
    ],
    related: ["/resources/flower-guides", "/resources/edibles-guides/how-long-do-edibles-take"],
    secondTake: {
      author: "riley",
      body: "The format decides the questions. Once you know whether you are reading a vape listing or a flower listing, the comparison gets cleaner fast.",
    },
  },
  {
    path: "/resources/value-guides/how-to-compare-flower-prices",
    kind: "article",
    parent: "/resources/value-guides",
    categoryLabel: "Value Guides",
    title: "How to Compare Flower Prices",
    seoTitle: "How to Compare Flower Prices | P60 Cannabis",
    metaDescription:
      "Compare cannabis flower prices by reading weight, current price, flower section, and product details together instead of reacting to one number.",
    h1: "How to Compare Flower Prices Without Ignoring Weight",
    excerpt:
      "The value play starts when price and weight are read together.",
    primaryKeyword: "how to compare flower prices",
    supportingKeywords: ["cheap weed York", "affordable flower York", "cannabis price per gram", "Budget flower"],
    searchIntent: "Compare cannabis flower price, weight, and value.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/budget_banner.webp",
      alt: "How to compare flower prices at P60 Cannabis",
    },
    intro: [
      "A flower price only makes sense beside the amount attached to it. If you want cheap weed in York without getting played by the layout, compare current price and weight together.",
    ],
    sections: [
      {
        heading: "Keep Price and Weight Together",
        body: [
          "Before judging value, confirm the listed weight, current posted price, flower section, and item notes. A smaller amount and a larger amount are not the same comparison.",
        ],
      },
      {
        heading: "Use Price Per Gram Carefully",
        body: [
          "Price per gram can help compare different quantities. Divide total price by listed grams when the page does not show it. Then keep reading, because math is not the whole menu.",
        ],
      },
      {
        heading: "Compare Within a Section First",
        body: [
          "Budget is easiest to compare against Budget, Premium against Premium, and Exotic against Exotic. Cross-section comparisons can work, but the section itself is part of the choice.",
        ],
      },
      {
        heading: "Search Language Can Stay Direct",
        body: [
          "Cheap weed, budget weed, affordable weed, and value flower are real shopper phrases. The answer should be direct: current price, current weight, and the right live category.",
        ],
      },
      {
        heading: "Browse Current Flower Sections",
        body: ["Use the live P60 Cannabis flower lanes for the current listing details."],
        links: [
          { label: "Browse Budget flower", href: "/budget" },
          { label: "Browse AA flower", href: "/aa" },
          { label: "Browse AAA+ flower", href: "/aaa" },
          { label: "Browse Premium flower", href: "/premium" },
          { label: "Browse Exotic flower", href: "/exotic" },
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse Budget flower", href: "/budget" },
      { label: "Browse Premium flower", href: "/premium" },
      { label: "Browse Exotic flower", href: "/exotic" },
    ],
    related: [
      "/resources/flower-guides/budget-vs-premium-flower",
      "/resources/flower-guides/aa-vs-aaa-vs-premium-vs-exotic",
    ],
    secondTake: {
      author: "riley",
      body: "The cleanest value read is boring in the best way: section, product, size, current price. After that, the deal can talk.",
    },
  },
  {
    path: "/resources/local-guides/weed-dispensary-in-york",
    kind: "article",
    parent: "/resources/local-guides",
    categoryLabel: "Local Guides",
    title: "Weed Dispensary in York",
    seoTitle: "Weed Dispensary in York | P60 Cannabis",
    metaDescription:
      "Find P60 Cannabis at 1938 Weston Rd in York, with current store information, menu categories, local visit planning, and helpful links.",
    h1: "Weed Dispensary in York: A Weston Road Guide",
    excerpt:
      "Confirm the right P60 store page first, then go straight to the menu lane that matches the visit.",
    primaryKeyword: "weed dispensary in York",
    supportingKeywords: ["cannabis store near Weston Road", "York weed store", "P60 Cannabis"],
    searchIntent: "Find local P60 Cannabis store and menu information.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/welcome_banner.webp",
      alt: "Weed dispensary in York guide for P60 Cannabis",
    },
    intro: [
      "If you searched for a weed dispensary in York, start with the exact store page for P60 Cannabis. The listed store address is 1938 Weston Rd, York, ON M9N 1W2.",
    ],
    sections: [
      {
        heading: "Start With the Exact Store",
        body: [
          "Broad local searches can surface several results. Use the P60 Cannabis store page to confirm the address, hours, phone, and visit information.",
        ],
        links: [{ label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" }],
      },
      {
        heading: "York and Weston Road Context",
        body: [
          "The store is connected to York and Weston Road search intent. Nearby-area language should help orientation, not become a pasted list in every paragraph.",
        ],
      },
      {
        heading: "Move From Local Search to Category",
        body: [
          "Once the store is confirmed, open the category that matches the trip: flower, pre-rolls, edibles, THC vapes, concentrates, cigarettes, accessories, or Magic Stuff.",
        ],
      },
      {
        heading: "Check Current Details Before Travelling for One Item",
        body: [
          "Product availability, posted prices, and category listings can change. If one exact item decides the trip, confirm the current page or call the store.",
        ],
      },
    ],
    commercialLinks: [
      { label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" },
      { label: "Open the FAQ", href: "/faq" },
      { label: "Browse current pre-rolls", href: "/items/prerolls" },
      { label: "Explore current edibles", href: "/items/edibles" },
    ],
    related: [
      "/resources/cannabis-101/how-to-read-a-cannabis-menu",
      "/resources/value-guides/how-to-compare-flower-prices",
    ],
    secondTake: {
      author: "riley",
      body: "A local guide earns its spot when it removes friction: the right store, the right page, and the right category.",
    },
  },
  {
    path: "/resources/native-smokes/native-cigarettes-guide",
    kind: "article",
    parent: "/resources/native-smokes",
    categoryLabel: "Native Smokes",
    title: "Cheap Native Cigarettes in York",
    seoTitle: "Cheap Native Cigarettes in York | P60 Cannabis",
    metaDescription:
      "P60 Cannabis has cheap native cigarettes in York at $25 per carton, with current carton names including Rolled Gold, Canadian, Nexus, Putters, and Time.",
    h1: "Cheap Native Cigarettes in York: $25 Cartons at P60",
    excerpt:
      "For adults 19+, P60 keeps the native cigarette carton offer simple: check the current brand, unit, and $25 carton listing before visiting.",
    primaryKeyword: "cheap native cigarettes in York",
    supportingKeywords: [
      "native cigarettes in York",
      "native smokes York",
      "native cigarettes Weston Road",
      "cigarettes P60 Cannabis",
    ],
    searchIntent: "Understand native cigarette selection checks before visiting.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/06_Cigarettes.webp",
      alt: "Native cigarettes in York guide at P60 Cannabis",
    },
    intro: [
      "Adults 19+ looking for cheap native cigarettes in York can start with the P60 carton lane: current inventory shows native cigarette carton options at $25 per carton.",
      "The names matter because shoppers often ask by brand first. P60 currently shows Rolled Gold, Canadian, Canadian Classics, Canadian Goose, Nexus, Putters, and Time carton options on the public cigarette menu.",
    ],
    sections: [
      {
        heading: "Available Native Cigarette Brands",
        body: [
          "Inventory checked from the public P60 cigarette menu on July 11, 2026. These are the current $25 per carton native cigarette names to know before visiting:",
        ],
        bullets: nativeCigaretteCartonLines,
      },
      {
        heading: "Cheap Native Cigarettes at $25 Per Carton",
        body: [
          "The resource positioning is simple: cheap native cigarettes at $25 per carton in York, with brand and variety checks handled before the trip. If a shopper wants full, lights, menthol, original, silver, or ultra-light options, the carton name is the first thing to confirm.",
        ],
        bullets: ["Brand", "Variety", "Pack or carton", "Quantity", "Current price", "Current availability"],
      },
      {
        heading: "Native Smokes and Native Cigarettes",
        body: [
          "Both phrases are common. The Resource Centre uses Native Smokes as the category name while using native cigarettes naturally where shoppers search it.",
        ],
      },
      {
        heading: "Use the York Store Page",
        body: [
          "P60 Cannabis store details should be confirmed on the current store page when hours, phone, or one exact item affects the trip. For cigarette shoppers, the live category is the fastest path from brand name to current listing.",
        ],
      },
      {
        heading: "Tobacco Health Notice",
        body: [
          "Smoking and nicotine use carry serious health risks. This guide provides store and menu-navigation information only. It does not make safety or health claims.",
        ],
      },
      {
        heading: "Current Links",
        body: ["Use the live cigarette category and native cigarette information page for current details."],
        links: [
          { label: "Browse current cigarettes", href: "/items/cigarettes" },
          { label: "Read native cigarettes York", href: "/info/native-cigarettes-york" },
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse current cigarettes", href: "/items/cigarettes" },
      { label: "Read native cigarettes York", href: "/info/native-cigarettes-york" },
      { label: "View P60 Cannabis store details", href: "/weed-dispensary-york" },
    ],
    related: ["/resources/native-smokes/packs-vs-cartons", "/resources/local-guides/weed-dispensary-in-york"],
    secondTake: {
      author: "team",
      body: "The $25 carton offer is clean and useful, but brand, package, and current listing information should still be confirmed before visiting for one exact cigarette product.",
    },
  },
  {
    path: "/resources/native-smokes/packs-vs-cartons",
    kind: "article",
    parent: "/resources/native-smokes",
    categoryLabel: "Native Smokes",
    title: "Cigarette Packs vs Cartons",
    seoTitle: "Cigarette Packs vs Cartons | P60 Cannabis",
    metaDescription:
      "Understand cigarette packs vs cartons, including P60 native cigarette carton options currently listed at $25 per carton and pack-only items that use a different unit.",
    h1: "Cigarette Packs vs Cartons: Read the Unit First",
    excerpt:
      "P60 has native cigarette carton options at $25 per carton, but pack-only and loose tobacco listings are different units.",
    primaryKeyword: "cigarette packs vs cartons",
    supportingKeywords: ["native cigarette carton", "native cigarette pack", "cigarette packaging guide"],
    searchIntent: "Understand cigarette package units and comparisons.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/06_Cigarettes.webp",
      alt: "Cigarette packs vs cartons guide at P60 Cannabis",
    },
    intro: [
      "Cigarette packs vs cartons is a unit question before it is a price question. P60 currently lists cheap native cigarettes at $25 per carton, while pack-only products and loose tobacco items use different units.",
    ],
    sections: [
      {
        heading: "Cigarette Packs vs Cartons Start With the Unit",
        body: [
          "A pack listing refers to an individual retail pack. Check brand, variety, pack size where shown, current price, and current availability.",
        ],
      },
      {
        heading: "Carton Listings",
        body: [
          "A carton contains multiple packs. The current P60 native cigarette carton lineup uses $25 per carton positioning for listed carton names such as Rolled Gold, Canadian, Canadian Classics, Canadian Goose, Nexus, Putters, and Time.",
        ],
        bullets: nativeCigaretteBrandFamilies,
      },
      {
        heading: "Compare the Same Unit",
        body: [
          "Do not compare carton price and pack price as if they describe the same amount. Belmont KS pack-only, Backwoods, Grabba, and nicotine pouches are not the same listing unit as a $25 native cigarette carton.",
        ],
      },
      {
        heading: "Why Current Information Matters",
        body: [
          "Cigarette selection can rotate. Static resources can name the inventory checked on July 11, 2026, but adults 19+ should still use the live cigarette category before visiting for one exact brand.",
        ],
      },
      {
        heading: "Tobacco Health Notice",
        body: [
          "Smoking and nicotine use carry serious health risks. This page is informational and intended for adults 19+.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Browse current cigarettes", href: "/items/cigarettes" },
      { label: "Read native cigarettes York", href: "/info/native-cigarettes-york" },
    ],
    related: ["/resources/native-smokes/native-cigarettes-guide", "/resources/local-guides/weed-dispensary-in-york"],
    secondTake: {
      author: "mina",
      body: "Most confusion disappears once the unit is clear. Pack and carton are not two prices for the same amount.",
    },
  },
  {
    path: "/resources/magic-mushroom-guides/magic-mushroom-formats-explained",
    kind: "article",
    parent: "/resources/magic-mushroom-guides",
    categoryLabel: "Magic Mushroom Guides",
    title: "Magic Mushroom Formats Explained",
    seoTitle: "Magic Mushroom Formats Explained | P60 Cannabis",
    metaDescription:
      "Learn how magic mushroom and specialty-product formats may appear on a menu, including chocolates, gummies, capsules, dried products, and package information.",
    h1: "Magic Mushroom Formats Explained at the Menu Level",
    excerpt:
      "Format tells you how the product is packaged. It does not answer every question by itself.",
    primaryKeyword: "magic mushroom formats",
    supportingKeywords: ["magic mushroom chocolate", "mushroom gummies", "dried magic mushrooms", "mushroom capsules"],
    searchIntent: "Understand specialty-product menu formats.",
    author: "riley",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/09_Magic_Stuff.webp",
      alt: "Magic mushroom formats guide at P60 Cannabis",
    },
    intro: [
      "Magic mushroom formats can show up as dried products, chocolates, gummies, capsules, beverages, or other specialty items. The format explains packaging, not dosing, effects, medicine, or legality.",
    ],
    sections: [
      {
        heading: "Magic Mushroom Formats Start With the Package",
        body: [
          "Dried mushroom listings may identify the product by name, weight, and package information. Do not assume the listed weight or variety from a photo alone.",
        ],
      },
      {
        heading: "Chocolates",
        body: [
          "Chocolate products may be sold as bars or divided portions. Read the package information and confirm what any listed number refers to.",
        ],
      },
      {
        heading: "Gummies",
        body: [
          "Gummy products may be listed by package amount, count, or another strength notation. The menu title is not a substitute for the full label.",
        ],
      },
      {
        heading: "Capsules",
        body: [
          "Capsule products may organize the package by capsule count and listed amount. Current package information should decide the comparison.",
        ],
      },
      {
        heading: "Other Specialty Items",
        body: [
          "Some products do not fit one neat format. When the format or label is unclear, use the current listing and ask a specific question rather than guessing.",
        ],
      },
      {
        heading: "Important Boundary",
        body: [
          "This guide explains menu formats only. It does not provide dosing, consumption, therapeutic, medical, or legal advice.",
        ],
        links: [{ label: "Browse current Magic Stuff", href: "/items/magic" }],
      },
    ],
    commercialLinks: [{ label: "Browse current Magic Stuff", href: "/items/magic" }],
    related: ["/resources/magic-mushroom-guides/how-to-read-a-magic-mushroom-menu", "/resources/cannabis-101/how-to-read-a-cannabis-menu"],
    secondTake: {
      author: "team",
      body: "Specialty-product availability can vary. Use the current Magic Stuff category before planning a visit around a specific item.",
    },
  },
  {
    path: "/resources/magic-mushroom-guides/how-to-read-a-magic-mushroom-menu",
    kind: "article",
    parent: "/resources/magic-mushroom-guides",
    categoryLabel: "Magic Mushroom Guides",
    title: "How to Read a Magic Mushroom Menu",
    seoTitle: "How to Read a Magic Mushroom Menu | P60 Cannabis",
    metaDescription:
      "Read magic mushroom menu listings by checking format, package amount, listed strength, serving information, product notes, and current availability.",
    h1: "How to Read a Magic Mushroom Menu Without Guessing",
    excerpt:
      "Specialty-product listings should be read in layers: format, package, listed amount, notes, and current availability.",
    primaryKeyword: "how to read a magic mushroom menu",
    supportingKeywords: ["magic mushroom menu York", "mushroom chocolate menu", "mushroom gummy menu", "specialty products York"],
    searchIntent: "Learn specialty-product menu reading and label checks.",
    author: "mina",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/09_Magic_Stuff.webp",
      alt: "How to read a magic mushroom menu at P60 Cannabis",
    },
    intro: [
      "Knowing how to read a magic mushroom menu is about slowing the title down. Start with format, then package information, listed amount, product notes, and current availability.",
    ],
    sections: [
      {
        heading: "Identify the Format First",
        body: [
          "Start by confirming whether the product is dried, chocolate, gummy, capsule, beverage, or another specialty format. Different formats use different package language.",
        ],
      },
      {
        heading: "Find Out What the Number Describes",
        body: [
          "A number may refer to total package amount, amount per piece, piece count, product weight, or another label detail. The page or package should clarify which one applies.",
        ],
      },
      {
        heading: "Read Serving and Package Information",
        body: [
          "Where serving information is shown, read it beside the total package information. A front-facing title may not explain how the package is divided.",
        ],
      },
      {
        heading: "Check Current Availability",
        body: [
          "Specialty-product listings can rotate. Use the live P60 Magic Stuff category for current products.",
        ],
        links: [{ label: "Browse current Magic Stuff", href: "/items/magic" }],
      },
      {
        heading: "Important Boundary",
        body: [
          "This resource is menu-navigation information for adults 19+. It does not provide dosing, consumption, medical, therapeutic, or legal advice.",
        ],
      },
    ],
    commercialLinks: [{ label: "Browse current Magic Stuff", href: "/items/magic" }],
    related: ["/resources/magic-mushroom-guides/magic-mushroom-formats-explained", "/resources/cannabis-101/how-to-read-a-cannabis-menu"],
    secondTake: {
      author: "riley",
      body: "A clear specialty menu separates the product name from the information that actually explains the package.",
    },
  },
  {
    path: "/resources/store-updates/resource-centre-launch",
    kind: "update",
    parent: "/resources/store-updates",
    categoryLabel: "Store Updates",
    title: "P60 Cannabis Resource Centre Is Live",
    seoTitle: "P60 Cannabis Resource Centre Is Live",
    metaDescription:
      "P60 Cannabis has launched a new Resource Centre for flower, pre-rolls, edibles, vapes, value, local guides, native smokes, and specialty products.",
    h1: "The P60 Cannabis Resource Centre Is Now Live",
    excerpt:
      "The new resource section organizes practical adult 19+ guides by topic instead of burying them in a dated feed.",
    primaryKeyword: "P60 Cannabis Resource Centre",
    supportingKeywords: ["cannabis guides York", "P60 Cannabis updates", "cannabis resource centre York"],
    searchIntent: "Announce the P60 Cannabis Resource Centre launch.",
    author: "team",
    datePublished: updated,
    dateModified: updated,
    image: {
      src: "/banners/homepage_hero.webp",
      alt: "P60 Cannabis Resource Centre launch update",
    },
    intro: [
      "P60 Cannabis has launched a new Resource Centre for adults 19+ who want clearer information before browsing the current menu or planning a visit.",
    ],
    sections: [
      {
        heading: "What the Resource Centre Covers",
        body: [
          "The first release covers Cannabis 101, flower guides, pre-roll guides, edibles, THC vapes, value shopping, York local guides, native smokes, Magic Stuff, and official store updates.",
        ],
      },
      {
        heading: "Why the Structure Changed",
        body: [
          "Some questions stay useful for a long time. A guide to flower tiers, edible label reading, or menu terminology should remain easy to find.",
        ],
      },
      {
        heading: "Where to Begin",
        body: [
          "Visit the Resource Centre and choose the category that matches the question. Use the store page for current visit information and the live menu for current products, prices, weights, and availability.",
        ],
        links: [
          { label: "Open the Resource Centre", href: "/resources" },
          { label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" },
        ],
      },
      {
        heading: "What Happens Next",
        body: [
          "New resources should be added when there is a real customer question, a useful search opportunity, a verified store change, or a topic that deserves a complete answer.",
        ],
      },
    ],
    commercialLinks: [
      { label: "Open the Resource Centre", href: "/resources" },
      { label: "View the P60 Cannabis store page", href: "/weed-dispensary-york" },
    ],
    related: ["/resources", "/resources/store-updates"],
    secondTake: {
      author: "mina",
      body: "A resource hub should be easy to return to. Organizing the guides by topic gives every page a permanent job.",
    },
  },
];

export const RESOURCE_PAGE_BY_PATH = new Map(RESOURCE_PAGES.map((page) => [page.path, page]));

export function normalizeResourcePath(path: string) {
  if (path === "/resources/") return "/resources";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function getResourcePageBySlug(slug?: string[]) {
  const path = !slug || slug.length === 0 ? "/resources" : `/resources/${slug.join("/")}`;
  return RESOURCE_PAGE_BY_PATH.get(normalizeResourcePath(path));
}

export function getStaticResourceParams() {
  return RESOURCE_PAGES.map((page) => {
    if (page.path === "/resources") return { slug: [] as string[] };
    return { slug: page.path.replace(/^\/resources\/?/, "").split("/") };
  });
}

export function getCategoryPages() {
  return RESOURCE_PAGES.filter((page) => page.kind === "category");
}

export function getFeaturedPages() {
  return RESOURCE_PAGES.filter((page) => page.kind === "article").slice(0, 6);
}

export function getChildPages(parentPath: string) {
  return RESOURCE_PAGES.filter((page) => page.parent === parentPath);
}

export function getRelatedPages(page: ResourcePage) {
  return page.related
    .map((path) => RESOURCE_PAGE_BY_PATH.get(normalizeResourcePath(path)))
    .filter((related): related is ResourcePage => Boolean(related));
}
