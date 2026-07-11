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
  internal_links_used: string;
  relatedLinks: Array<{ title: string; url: string; description: string }>;
  editorialRemark: { label: string; authorName: string; authorHandle: string; authorRole: string; body: string };
  primaryKeyword: string;
  keywords: string[];
  oldTitle: string;
  wordCount: number;
  businessReviewFlags: string[];
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
    "title": "P60 Cannabis Menu Check on Weston Road",
    "seoTitle": "P60 Cannabis Menu Check on Weston Road | York Cannabis Blog",
    "seo_title": "P60 Cannabis Menu Check on Weston Road | York Cannabis Blog",
    "metaDescription": "P60 Cannabis Menu Check on Weston Road with address, hours, phone, menu-category checks, and practical planning notes for York shoppers.",
    "meta_description": "P60 Cannabis Menu Check on Weston Road with address, hours, phone, menu-category checks, and practical planning notes for York shoppers.",
    "h1": "P60 Cannabis Menu Check on Weston Road",
    "excerpt": "A practical York store-page and menu check for P60 Cannabis, with address, hours, phone, and browsing tips.",
    "authorName": "Weston Jay",
    "authorHandle": "@WestonJay",
    "authorRole": "House Writer",
    "author": "By Weston Jay \\u00b7 @WestonJay",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-02",
    "modifiedDate": "2026-07-11",
    "category": "Store Guide",
    "readTime": "4 min",
    "content": "Quick answer: P60 Cannabis is listed at 1938 Weston Rd, York, ON M9N 1W2. The listed phone number is (437) 522-2802, and the site lists the store as open daily from 10 AM to 3 AM. If you are checking a weed dispensary in York, start with the store page, then move into the menu category that matches the trip. That keeps the browse clean and keeps old screenshots from bossing you around.\n\n## Start With The Right Store Page\n\nSmall but important: this is P60 Cannabis on Weston Road in York, not The Planet 60 in Brampton and not any other similarly named shop. That name tangle is exactly why the address check matters. The web gets messy when store names, neighbourhood names, and old tabs start floating around. The easiest fix is not fancy: match the address, match the phone number, then browse from the current site navigation.\n\nBecause the site lists late hours, it can be useful for people searching for an open late cannabis store or weed dispensary in York. Check the live page before leaving, because hours are only useful when they are current. This is especially true if you are trying to make a quick stop. A stale menu tab can make a simple cannabis store run feel like a treasure hunt, and nobody needs that extra drama.\n\n## Browse By Product Lane\n\nThe fastest path is to pick the lane first. Flower shoppers can start with Budget, AA, AAA+, Premium, or Exotic flower. People looking for something already rolled can jump into pre-rolls. Edibles, THC vapes, concentrates, accessories, and cigarettes each deserve their own check instead of being mashed into one giant scroll.\n\nIf cheap weed or affordable weed is the point, begin in Budget and AA before comparing the higher flower tiers. If premium flower or exotic flower is the mood, go straight there and compare the current listings. The point is not to memorize every page. The point is to stop wandering through pages that were never your lane.\n\n## What To Check Before Leaving\n\nBring valid government ID. Confirm the address, hours, and phone number on the store page. If you need one exact item, check the live category page and call the listed number when a yes-or-no answer matters. Menu pages can change, and that is normal; the current page beats a saved tab every time.\n\nFor a York cannabis dispensary search, this guide is the calm version of the checklist: verify the store, choose the lane, then use the live page for the details. Use the live store pages for the current information before visiting.\n\n## FAQ\n\n### Where is P60 Cannabis?\nP60 Cannabis is listed at 1938 Weston Rd, York, ON M9N 1W2.\n\n### What hours are listed?\nThe site lists P60 Cannabis as open daily from 10 AM to 3 AM.\n\n### Does this article confirm current stock?\nNo. Use the current menu and category pages for current listings before visiting.\n\n### What should shoppers bring?\nBring valid government identification and use the store page for the current visit details.",
    "faq": "",
    "internal_links_used": "[Flower menu](/premium)\\n[Current menu categories](/)\\n[P60 Cannabis store page](/weed-dispensary-york)\\n[P60 Cannabis blog](/blog)",
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
      "body": "The address check is not boring; it is the part that saves the trip. Store names and old tabs can blur together, so matching Weston Rd, the phone number, and the current page is worth the minute. Use the live page before visiting."
    },
    "primaryKeyword": "weed dispensary in York",
    "keywords": [
      "weed dispensary in York",
      "cannabis store in York",
      "York weed store",
      "open late cannabis store",
      "weed store",
      "cannabis dispensary"
    ],
    "oldTitle": "P60 Cannabis Local Store Guide for Adults 19+",
    "wordCount": 506,
    "businessReviewFlags": []
  },
  {
    "slug": "p60-cannabis-price-flower-tier-guide",
    "title": "How to Read the P60 Cannabis Flower Menu",
    "seoTitle": "How to Read the P60 Cannabis Flower Menu | York Cannabis Blog",
    "seo_title": "How to Read the P60 Cannabis Flower Menu | York Cannabis Blog",
    "metaDescription": "How to Read the P60 Cannabis Flower Menu with natural notes on Budget, AA, AAA+, Premium, and Exotic flower for York shoppers.",
    "meta_description": "How to Read the P60 Cannabis Flower Menu with natural notes on Budget, AA, AAA+, Premium, and Exotic flower for York shoppers.",
    "h1": "How to Read the P60 Cannabis Flower Menu",
    "excerpt": "A cleaner way to compare P60 Cannabis flower tiers, from budget weed to premium and exotic flower.",
    "authorName": "Maya Sixty",
    "authorHandle": "@MayaSixty",
    "authorRole": "House Writer",
    "author": "By Maya Sixty \\u00b7 @MayaSixty",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-09",
    "modifiedDate": "2026-07-11",
    "category": "Flower Guide",
    "readTime": "4 min",
    "content": "Flower menus get easier when you stop reading them like a novel. At P60 Cannabis, the useful first move is to choose the flower lane: Budget, AA, AAA+, Premium, or Exotic. Once the lane is right, compare the current strains and weights on the live page.\n\nThat is the whole advantage of a tiered cannabis menu. It lets someone looking for cheap weed in York start low without apology, while someone chasing premium flower or exotic flower can skip straight to the higher shelves. Same menu, less wandering.\n\n## The Flower Lanes\n\nBudget is the value lane. It is the place to start when affordable weed is the main mission and the exact strain can come second. AA is still value-minded, but it gives shoppers another step above the lowest price lane. AAA+ is the middle lane for people who want stronger flower-page filtering without immediately jumping into the top tiers.\n\nPremium flower is for shoppers who want the menu to feel a little more selective. Exotic flower is the top lane and should be checked when the first question is not simply price. None of those labels replace the live product listing. They organize the browse so you know where to look first.\n\n## Read Price And Weight Together\n\nA flower price only tells half the story if you do not look at the weight beside it. The menu structure commonly shows smaller single-gram pricing and larger bundle-style weights, so compare the total spend and the approximate value per gram before deciding. That is where weed deals become clearer without turning the page into math class.\n\nBudget and AA can make sense for routine value shopping. AAA+ often works as the comparison lane when you want more strength from the menu without going straight to the top. Premium and Exotic are where quality-first shoppers usually start. If you are unsure, open two tiers side by side and compare the current listings instead of guessing from the label alone.\n\n## Local Search, Real Page\n\nP60 Cannabis is listed at 1938 Weston Rd, York, ON M9N 1W2, with the site listing the store as open daily from 10 AM to 3 AM. If you are comparing a weed store in York, use those details to confirm you are in the right place, then let the flower tiers do the sorting.\n\nThe clean move: choose Budget for cheap weed, AA or AAA+ for value-plus browsing, Premium for a stronger flower lane, and Exotic when top-tier flower is the point. Then check the live page before visiting, because cannabis menus change and pretending otherwise is how people end up annoyed at a counter. Use the live store pages for the current information before visiting.\n\n## FAQ\n\n### Which flower tier should I check first?\nStart with the tier that matches the trip: Budget for value, AA or AAA+ for middle-lane browsing, Premium for higher-grade flower, and Exotic for the top lane.\n\n### Does this guide guarantee prices or stock?\nNo. It explains how to read the menu structure. Use the live category page for current listings.\n\n### Why do weights matter?\nDifferent weights can change the practical value. Compare the total price and the amount before choosing.\n\n### Is this useful for local York shoppers?\nYes. It is written for people checking P60 Cannabis and its current flower menu before visiting.",
    "faq": "",
    "internal_links_used": "[Budget flower](/budget)\\n[Premium flower](/premium)\\n[Exotic flower](/exotic)\\n[P60 Cannabis store page](/weed-dispensary-york)\\n[P60 Cannabis blog](/blog)",
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
      "authorName": "P60 Cannabis Desk",
      "authorHandle": "@P60Desk",
      "authorRole": "Store Editorial Desk",
      "body": "One thing I would add: the flower tier is a starting point, not the finish line. If budget is tight, compare Budget and AA first, then move up only when the current listing gives you a reason. Use the live store pages for the current information before visiting."
    },
    "primaryKeyword": "flower menu York",
    "keywords": [
      "weed dispensary in York",
      "cannabis store in York",
      "York weed store",
      "cheap weed",
      "affordable weed",
      "budget weed",
      "premium flower",
      "exotic flower",
      "weed deals"
    ],
    "oldTitle": "P60 Cannabis Price and Flower Tier Guide",
    "wordCount": 550,
    "businessReviewFlags": []
  },
  {
    "slug": "p60-cannabis-local-visit-guide-2026",
    "title": "P60 Cannabis Menu Guide: Flower, Edibles, Pre-Rolls, Vapes and Concentrates",
    "seoTitle": "P60 Cannabis Menu Guide: Flower, Edibles, Pre-Rolls, Vapes and Concentrates | York",
    "seo_title": "P60 Cannabis Menu Guide: Flower, Edibles, Pre-Rolls, Vapes and Concentrates | York",
    "metaDescription": "P60 Cannabis Menu Guide: Flower, Edibles, Pre-Rolls, Vapes and Concentrates covering flower, edibles, pre-rolls, THC vapes, concentrates, accessories, and store-page checks.",
    "meta_description": "P60 Cannabis Menu Guide: Flower, Edibles, Pre-Rolls, Vapes and Concentrates covering flower, edibles, pre-rolls, THC vapes, concentrates, accessories, and store-page checks.",
    "h1": "P60 Cannabis Menu Guide: Flower, Edibles, Pre-Rolls, Vapes and Concentrates",
    "excerpt": "A practical menu guide for P60 Cannabis: flower, edibles, pre-rolls, THC vapes, concentrates, accessories, and cigarettes.",
    "authorName": "P60 Cannabis Desk",
    "authorHandle": "@P60Desk",
    "authorRole": "Store Editorial Desk",
    "author": "By P60 Cannabis Desk \\u00b7 @P60Desk",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-09",
    "modifiedDate": "2026-07-11",
    "category": "Menu Guide",
    "readTime": "4 min",
    "content": "P60 Cannabis has a menu that is easier to use when you stop treating every category like the same errand. Flower, edibles, pre-rolls, THC vapes, concentrates, accessories, and cigarettes solve different shopping problems. Pick the problem first, then pick the page.\n\nQuick summary: use flower tiers when price or grade matters, pre-rolls when convenience matters, edibles when format matters, THC vapes when device style matters, and concentrates when the category is already familiar. If you are checking delivery or cigarettes, use those pages directly instead of hoping they appear in the middle of another menu.\n\n## Flower Is The Main Map\n\nFlower has the clearest structure because the tiers give you a natural starting point. Budget and AA help shoppers looking for affordable weed. AAA+ is a strong middle lane. Premium and Exotic are the higher lanes for shoppers who want to compare quality first. It is menu navigation, not a personality test.\n\nThat matters for local cannabis dispensary searches because people are rarely searching in the abstract. Someone looking for a weed dispensary in York usually wants to know whether the store is relevant right now: where it is, what broad categories are easy to browse, and whether the trip is worth making.\n\n## Categories That Save Time\n\nPre-rolls are the shortcut when rolling is not on the agenda. Edibles keep gummies, chocolates, drinks, and similar formats in their own lane. THC vapes separate cartridge-style shopping from flower. Concentrates get their own space because they are not a casual substitute for every shopper. Accessories are listed separately from cannabis product categories, which keeps the menu cleaner.\n\nCigarettes are also split into their own category on the site. If you are comparing cheap cigarettes or native cigarettes, check the live cigarettes page directly instead of relying on a passing mention in a cannabis article. Category pages are useful because they keep different errands from stepping on each other.\n\n## Store Details Before The Trip\n\nP60 Cannabis is listed at 1938 Weston Rd, York, ON M9N 1W2. The listed phone number is (437) 522-2802, and the site lists the store as open daily from 10 AM to 3 AM. For a York weed store check, those details are the anchor. After that, the menu categories are the working map: flower tiers for cannabis flower, item categories for formats, and the store page for address and contact details.\n\nIf one exact product matters, call the listed phone number or check the live page before you leave. If the goal is just to browse, start broad, narrow the lane, and let the current menu do the last bit. Use the live store pages for the current information before visiting.\n\n## FAQ\n\n### What menu category should I start with?\nStart with the category that matches the product type: flower, pre-rolls, edibles, THC vapes, concentrates, accessories, or cigarettes.\n\n### Does this guide list current inventory?\nNo. It explains how to use the current menu pages without claiming live stock.\n\n### Where should local shoppers confirm store details?\nUse the P60 Cannabis store page for address, phone, listed hours, and visit details.\n\n### Is delivery confirmed here?\nNo. If the site shows delivery options, use the current delivery page or contact the store for current details.",
    "faq": "",
    "internal_links_used": "[Pre-rolls](/items/prerolls)\\n[Edibles](/items/edibles)\\n[THC vapes](/items/vapes)\\n[Concentrates](/items/concentrates)\\n[P60 Cannabis store page](/weed-dispensary-york)\\n[P60 Cannabis blog](/blog)",
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
      "authorName": "Weston Jay",
      "authorHandle": "@WestonJay",
      "authorRole": "House Writer",
      "body": "The category split is doing more work than people notice. A shopper looking for pre-rolls, edibles, THC vapes, or cigarettes should not have to dig through flower lanes first. Use the live page before visiting."
    },
    "primaryKeyword": "cannabis menu York",
    "keywords": [
      "weed dispensary in York",
      "cannabis store in York",
      "York weed store",
      "pre-rolls",
      "edibles",
      "THC vapes",
      "concentrates",
      "cheap cigarettes",
      "delivery"
    ],
    "oldTitle": "P60 Cannabis Local Visit Guide for Adults 19+",
    "wordCount": 533,
    "businessReviewFlags": []
  }
];

export function getStaticPost(slug: string): StaticBlogPost | undefined {
  return STATIC_POSTS.find((post) => post.slug === slug);
}

export function getBlogRedirect(slug: string): string | undefined {
  return BLOG_REDIRECTS[slug];
}
