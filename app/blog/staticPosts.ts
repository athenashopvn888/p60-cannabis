export interface StaticBlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  seo_title: string;
  metaDescription: string;
  meta_description: string;
  h1: string;
  excerpt: string;
  authorName: string;
  authorHandle: string;
  authorRole: string;
  author: string;
  structuredAuthorName: string;
  date: string;
  modifiedDate: string;
  category: string;
  readTime: string;
  content: string;
  faq: string;
  relatedLinks: Array<{ title: string; url: string; description: string }>;
  editorialRemark: { label: string; authorName: string; authorHandle: string; authorRole: string; body: string };
}

export const STORE_BLOG_CONFIG = {
  "storeCode": "PNY01",
  "storeName": "P60 Cannabis",
  "city": "York",
  "domain": "www.p60cannabis.com",
  "storePath": "/weed-dispensary-york",
  "address": "1938 Weston Rd, York, ON M9N 1W2",
  "phone": "(437) 522-2802",
  "hours": "open daily from 10 AM to 3 AM"
};

export const BLOG_REDIRECTS: Record<string, string> = {
  "p60-cannabis-local-visit-guide-adults-19": "p60-cannabis-york-store-guide",
  "p60-cannabis-flower-tier-guide": "p60-cannabis-price-flower-tier-guide",
  "p60-cannabis-category-menu-cheat-sheet": "p60-cannabis-local-visit-guide-2026"
};

export const STATIC_POSTS: StaticBlogPost[] = [
  {
    "slug": "p60-cannabis-york-store-guide",
    "title": "How to Plan a P60 Cannabis Visit Without Guessing",
    "seoTitle": "P60 Cannabis Visit Guide | Weed Dispensary in York",
    "seo_title": "P60 Cannabis Visit Guide | Weed Dispensary in York",
    "metaDescription": "Plan a York visit to P60 Cannabis with a clear shopper checklist for store details, menu categories, current listings, and staff questions.",
    "meta_description": "Plan a York visit to P60 Cannabis with a clear shopper checklist for store details, menu categories, current listings, and staff questions.",
    "h1": "How to Plan a P60 Cannabis Visit Without Guessing",
    "excerpt": "A practical visit guide for P60 Cannabis, written for shoppers who want the next step without the runaround.",
    "authorName": "Weston Jay",
    "authorHandle": "@WestonJay",
    "authorRole": "House Writer",
    "author": "Weston Jay",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-02",
    "modifiedDate": "2026-07-11",
    "category": "Store Guide",
    "readTime": "4 min",
    "content": "## How to Plan a P60 Cannabis Visit Without Guessing\n\nA cannabis store visit should not feel like clicking through a mystery menu. If you are checking P60 Cannabis around York, start with the boring-but-useful stuff first: confirm the store page, pick one category, and use the live menu for the current details.\n\nWhether you searched for a weed dispensary in York, a cannabis dispensary, or a weed store nearby, the goal is the same: make the next step easier before you leave.\n\n## 1. Always Check The Store Page First\n\nBefore you compare strains, prices, or formats, get the basics out of the way. Check the store page for the address or directions, hours, contact options, and the main menu links. If one product is going to make or break the visit, check the live menu or call before heading out.\n\nPro tip: no guide, including this one, can track live inventory minute by minute. The current menu and the store staff are your best friends for specific questions.\n\n## 2. Pick One Category To Start\n\nWant the fastest shopping experience? Start with the product type. If you are a flower shopper, go straight to the flower sections. If you want pre-rolls, edibles, THC vapes, concentrates, or accessories, use those category pages instead of wandering through everything at once.\n\nIf value is the mission, start with cheap weed, affordable weed, or budget weed comparisons. If the visit is more about premium flower or exotic flower, start there and compare what is actually listed today.\n\n## 3. Compare What Is Current\n\nDo not shop from memory. Open the category that fits the visit and compare the current listings inside it. Look at:\n\n- Product name or strain.\n- Weight.\n- Price.\n- Item notes.\n\nIf a detail is unclear, ask staff before choosing. It is easier to ask one sharp question than to scroll through five pages hoping the answer jumps out.\n\n## 4. Keep The Visit Simple\n\nFlower sections are for flower. Pre-rolls, edibles, THC vapes, concentrates, and accessories each answer a different shopping question. Keep those formats separate and the whole menu gets easier to use.\n\nFor P60 Cannabis, the smooth path is simple: confirm the store page, choose one category, compare the current listing, then ask staff if one detail still matters. That is how you turn a York dispensary search into an actual plan.",
    "faq": "",
    "relatedLinks": [
      {
        "title": "Flower menu",
        "url": "/premium",
        "description": "Start with a flower tier if you already know flower is the lane."
      },
      {
        "title": "Current menu categories",
        "url": "/",
        "description": "Use the homepage navigation to jump into the current category pages."
      },
      {
        "title": "P60 Cannabis store page",
        "url": "/weed-dispensary-york",
        "description": "Check the York store page for address, phone, hours, and visit details."
      },
      {
        "title": "P60 Cannabis blog",
        "url": "/blog",
        "description": "Browse the store guide archive and future menu notes."
      }
    ],
    "editorialRemark": {
      "label": "Another House Writer Adds",
      "authorName": "Maya Sixty",
      "authorHandle": "@MayaSixty",
      "authorRole": "House Writer",
      "body": "One extra move I like: keep the store page open until the visit is actually happening. Old tabs make people confident about the wrong details, and that is how a quick stop turns into a detour nobody asked for."
    },
  },
  {
    "slug": "p60-cannabis-price-flower-tier-guide",
    "title": "How to Compare P60 Cannabis Flower Without Guessing",
    "seoTitle": "P60 Cannabis Flower Guide | Budget to Exotic",
    "seo_title": "P60 Cannabis Flower Guide | Budget to Exotic",
    "metaDescription": "Compare P60 Cannabis flower sections with natural guidance for cheap weed, budget weed, premium flower, exotic flower, and current menu checks.",
    "meta_description": "Compare P60 Cannabis flower sections with natural guidance for cheap weed, budget weed, premium flower, exotic flower, and current menu checks.",
    "h1": "How to Compare P60 Cannabis Flower Without Guessing",
    "excerpt": "A shopper-first flower guide for comparing Budget, AA, AAA+, Premium, and Exotic sections at P60 Cannabis.",
    "authorName": "Maya Sixty",
    "authorHandle": "@MayaSixty",
    "authorRole": "House Writer",
    "author": "Maya Sixty",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-09",
    "modifiedDate": "2026-07-11",
    "category": "Flower Guide",
    "readTime": "4 min",
    "content": "## How to Compare P60 Cannabis Flower Without Guessing\n\nFlower menus get easier when you stop treating every section like the same shelf with different labels. At P60 Cannabis, sections like Budget, AA, AAA+, Premium, and Exotic are there to help you choose where to start.\n\nThe trick is simple: pick the lane first, then compare the current listings. Do not let an old price memory, an old screenshot, or a half-remembered strain name do the shopping for you.\n\n## 1. Start With Your Budget\n\nIf the main goal is cheap weed, affordable weed, or budget weed, start with Budget or AA. That does not mean you are settling; it means you are shopping with a plan.\n\nIf you are looking for premium flower or exotic flower, start in those sections instead. The point is not to crown one section as the winner. The point is to get to the right part of the flower menu faster.\n\n## 2. Read Price, Weight, And Item Notes Together\n\nA flower listing only makes sense when you read the full line. Compare the product name, weight, price, and any item notes shown on the live menu. A low price matters less if the size is not what you expected. A higher section matters less if the current listing does not match what you want.\n\nPro tip: the live menu beats memory every time. If the detail matters, check the current listing or ask staff before you choose.\n\n## 3. Do Not Mix Flower With Every Other Format\n\nFlower is its own shopping lane. If you actually want pre-rolls, edibles, THC vapes, concentrates, or accessories, jump to those pages instead. Comparing flower when you really want a pre-roll is how a quick visit turns into a scroll session.\n\n## 4. Ask A Better Question\n\nInstead of asking, what is good, start with the section you are comparing. Try: what is current in Budget? What is listed in Premium? What exotic flower is on the menu today?\n\nThat one change makes P60 Cannabis easier to shop. You are not guessing from the whole menu; you are comparing the section that actually fits the visit.",
    "faq": "",
    "relatedLinks": [
      {
        "title": "Budget flower",
        "url": "/budget",
        "description": "Start here when affordable weed or budget flower is the priority."
      },
      {
        "title": "Premium flower",
        "url": "/premium",
        "description": "Compare the premium flower lane before moving up or down the menu."
      },
      {
        "title": "Exotic flower",
        "url": "/exotic",
        "description": "Use this lane when exotic flower is the first thing you want to compare."
      },
      {
        "title": "P60 Cannabis store page",
        "url": "/weed-dispensary-york",
        "description": "Check the York store page for address, phone, hours, and visit details."
      },
      {
        "title": "P60 Cannabis blog",
        "url": "/blog",
        "description": "Browse the store guide archive and future menu notes."
      }
    ],
    "editorialRemark": {
      "label": "Another House Writer Adds",
      "authorName": "Weston Jay",
      "authorHandle": "@WestonJay",
      "authorRole": "House Writer",
      "body": "The cleanest flower question is not always what is best. It is what section am I comparing today? Budget, AA, AAA+, Premium, and Exotic all save time when the shopper chooses the lane first and checks what is current before deciding."
    },
  },
  {
    "slug": "p60-cannabis-local-visit-guide-2026",
    "title": "How to Shop the P60 Cannabis Menu Like a Pro",
    "seoTitle": "P60 Cannabis Menu Guide | York Weed Store",
    "seo_title": "P60 Cannabis Menu Guide | York Weed Store",
    "metaDescription": "Shop the P60 Cannabis menu with a simple shopper-first guide to flower, pre-rolls, edibles, THC vapes, concentrates, and current listings.",
    "meta_description": "Shop the P60 Cannabis menu with a simple shopper-first guide to flower, pre-rolls, edibles, THC vapes, concentrates, and current listings.",
    "h1": "How to Shop the P60 Cannabis Menu Like a Pro",
    "excerpt": "A natural guide to shopping the P60 Cannabis menu without turning the visit into a guessing game.",
    "authorName": "Weston Jay",
    "authorHandle": "@WestonJay",
    "authorRole": "House Writer",
    "author": "Weston Jay",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-09",
    "modifiedDate": "2026-07-11",
    "category": "Menu Guide",
    "readTime": "4 min",
    "content": "## How to Shop the P60 Cannabis Menu Like a Pro\n\nNavigating a cannabis menu should not feel like a guessing game. Whether you are a seasoned regular or a first-time shopper looking for a clean, simple way to find exactly what you need around York, this guide gives you the shopper version: less wandering, better questions, and a smoother visit.\n\n## 1. Always Check The Store Page First\n\nBefore you start browsing strains and comparing THC percentages, get the logistics out of the way. Hit the main store page to double-check the address or directions, hours, contact options, and the current menu links.\n\nPro tip: no guide, including this one, can track live inventory minute by minute. If a specific product is going to make or break the visit, the live menu or store staff are your best bet for a current answer.\n\n## 2. Pick One Category To Start\n\nWant the fastest, easiest shopping experience? Start your visit by focusing on just one product type. If you are a flower shopper, dive straight into the flower menu first before getting distracted by everything else.\n\nIf you are comparing cheap weed, affordable weed, or budget weed, start with the value flower sections. If you want premium flower or exotic flower, go straight to those sections and compare what is live now.\n\n## 3. Compare What Is Currently On The Shelf\n\nForget trying to memorize prices from your last visit. Always look at what is actively listed on the current menu.\n\nOpen the category you chose and compare the current listings:\n\n- Product name or strain.\n- Weight.\n- Price.\n- Item notes.\n\nIf any detail is unclear, ask staff. It is the easiest way to compare your options without guessing.\n\n## 4. Keep Your Formats Separate\n\nKeep it simple: flower sections are for flower. If you are hunting for pre-rolls, edibles, THC vapes, concentrates, or accessories, head straight to those category pages instead of mixing them all together.\n\nKeeping your browsing separated by format makes it much easier to find exactly what you are looking for. That is the real pro move: choose the lane, check what is current, then ask one good question if you still need help.",
    "faq": "",
    "relatedLinks": [
      {
        "title": "Pre-rolls",
        "url": "/items/prerolls",
        "description": "Jump straight to pre-rolls when convenience is the shopping lane."
      },
      {
        "title": "Edibles",
        "url": "/items/edibles",
        "description": "Use the edibles page for gummies, chocolates, drinks, and other listed edible formats."
      },
      {
        "title": "THC vapes",
        "url": "/items/vapes",
        "description": "Browse the THC vape category and confirm current options before visiting."
      },
      {
        "title": "Concentrates",
        "url": "/items/concentrates",
        "description": "Check concentrates separately so they do not get lost inside the full menu."
      },
      {
        "title": "P60 Cannabis store page",
        "url": "/weed-dispensary-york",
        "description": "Check the York store page for address, phone, hours, and visit details."
      },
      {
        "title": "P60 Cannabis blog",
        "url": "/blog",
        "description": "Browse the store guide archive and future menu notes."
      }
    ],
    "editorialRemark": {
      "label": "Another House Writer Adds",
      "authorName": "Maya Sixty",
      "authorHandle": "@MayaSixty",
      "authorRole": "House Writer",
      "body": "The menu feels less crowded once the first decision is format. Flower, pre-rolls, edibles, THC vapes, and concentrates are not the same errand, so they should not be browsed like one. Pick the lane first and the whole page gets friendlier."
    },
  }
];

export function getStaticPost(slug: string): StaticBlogPost | undefined {
  return STATIC_POSTS.find((post) => post.slug === slug);
}

export function getBlogRedirect(slug: string): string | undefined {
  return BLOG_REDIRECTS[slug];
}

