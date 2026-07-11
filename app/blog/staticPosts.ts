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
    "title": "Is P60 Cannabis the Right Weed Dispensary in York for Your Visit?",
    "seoTitle": "P60 Cannabis Weed Dispensary in York | Visit Guide",
    "seo_title": "P60 Cannabis Weed Dispensary in York | Visit Guide",
    "metaDescription": "Plan a York visit to P60 Cannabis with store-page checks, menu categories, and practical next steps for adults 19+.",
    "meta_description": "Plan a York visit to P60 Cannabis with store-page checks, menu categories, and practical next steps for adults 19+.",
    "h1": "Is P60 Cannabis the Right Weed Dispensary in York for Your Visit?",
    "excerpt": "A practical York visit guide for adults 19+ checking P60 Cannabis.",
    "authorName": "Weston Jay",
    "authorHandle": "@WestonJay",
    "authorRole": "House Writer",
    "author": "Weston Jay",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-02",
    "modifiedDate": "2026-07-11",
    "category": "Store Guide",
    "readTime": "4 min",
    "content": "## Is P60 Cannabis the Right Weed Dispensary in York for Your Visit?\n\nUse P60 Cannabis as the starting point when you want a practical store check in York: confirm the store page, choose the category that matches your visit, and use the current menu or staff for item-specific details. Adults 19+ should bring valid government ID and check the store page before leaving.\n\nA shopper looking for a weed dispensary in York, a cannabis dispensary in York, or a weed store in York usually needs a simple answer first: is this the right store page for the visit? Once that is clear, the menu becomes easier to use.\n\n## Confirm The Store Page First\n\nStart with the store page before comparing product categories. That page is the best place to check the store name, address or directions, contact options, hours, and the main menu paths shown on the site. If timing matters, or if one product would decide the trip, contact the store before leaving.\n\nThis keeps the article useful without pretending that a blog post knows live inventory. Menus change. The current page and the staff answer are what matter when the question gets specific.\n\n## Choose One Category To Start\n\nThe fastest visit usually starts with one product type. Flower shoppers can compare Budget, AA, AAA+, Premium, or Exotic when those sections are available. Value shoppers may start with cheap weed, affordable weed, or budget weed searches, while other shoppers may want premium flower or exotic flower first.\n\nIf flower is not the point, skip straight to pre-rolls, edibles, THC vapes, concentrates, or accessories. That first category choice saves time because each format answers a different question.\n\n## Keep The Visit Practical\n\nFor P60 Cannabis, the clean path is simple: confirm the store page, choose the category, then ask about current listings when needed. That gives adults 19+ a useful way to plan a cannabis store visit in York without stock promises, old prices, or awkward wording.\n\n## Quick Takeaway\n\nPick the store page first and the category second. If the visit is about cheap weed, start with the value flower sections. If it is about pre-rolls, edibles, THC vapes, or concentrates, use those pages directly. The right first click makes the rest of the visit calmer.",
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
      "body": "A store guide works best when it gives the reader one clean next move. Confirm the store page first, then pick the category that matches the visit. That keeps the wording useful for shoppers without pretending every product question has the same answer."
    },
  },
  {
    "slug": "p60-cannabis-price-flower-tier-guide",
    "title": "P60 Cannabis Flower Guide: Budget, Premium and Exotic Sections",
    "seoTitle": "P60 Cannabis Flower Guide | York Budget to Exotic",
    "seo_title": "P60 Cannabis Flower Guide | York Budget to Exotic",
    "metaDescription": "Compare P60 Cannabis flower sections including Budget, AA, AAA+, Premium, and Exotic with current-menu checks and natural value wording.",
    "meta_description": "Compare P60 Cannabis flower sections including Budget, AA, AAA+, Premium, and Exotic with current-menu checks and natural value wording.",
    "h1": "P60 Cannabis Flower Guide: Budget, Premium and Exotic Sections",
    "excerpt": "A clear flower guide for P60 Cannabis, from cheap weed and budget weed searches to premium flower and exotic flower browsing.",
    "authorName": "Maya Sixty",
    "authorHandle": "@MayaSixty",
    "authorRole": "House Writer",
    "author": "Maya Sixty",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-09",
    "modifiedDate": "2026-07-11",
    "category": "Flower Guide",
    "readTime": "4 min",
    "content": "## P60 Cannabis Flower Guide: Budget, Premium and Exotic Sections\n\nFlower shopping gets easier when the menu is separated into clear sections. P60 Cannabis uses flower paths such as Budget, AA, AAA+, Premium, and Exotic when those pages are available, giving adults 19+ a simple way to start comparing current listings.\n\nThe section name helps with the first click. It does not guarantee price, strength, quality, or stock. Use the live listing for product names, weights, prices, and item details before deciding.\n\n## Start With The Flower Question\n\nIf value matters most, start with Budget or AA. That is the natural place for cheap weed, affordable weed, and budget weed comparisons. If the visit is less about the lowest spend and more about browsing a different section, check AAA+, Premium, or Exotic.\n\nPremium flower and exotic flower are useful search phrases because shoppers use them, but the article should still stay honest: the live menu has to do the final work. A section label is a doorway, not a product promise.\n\n## Compare What Is Current\n\nOpen the section that fits the visit and compare the current listings inside it. Look at the posted product name, weight, price, and item notes. If a detail is unclear, ask staff before choosing.\n\nThat approach is better than memorizing an old price example. It also keeps the page useful for a shopper who wants a cannabis store in York and needs a clean way to compare flower without guessing.\n\n## Keep Flower Separate From Other Formats\n\nFlower sections are for flower. If the visit is about pre-rolls, edibles, THC vapes, concentrates, or accessories, use those category pages instead. Mixing every product type into a flower decision makes the menu harder to read.\n\n## Simple Flower Path\n\nUse this order: pick Budget, AA, AAA+, Premium, or Exotic; compare the live listings; check the store page if you need visit details; and ask staff when a current item question needs a direct answer. That is enough structure for value shoppers, premium flower shoppers, and anyone trying to avoid a messy menu browse.",
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
      "body": "The flower section is a starting point, not the finish line. If budget is tight, compare Budget and AA first, then move up only when the current listing gives you a reason. Cheap weed and premium flower can both be useful searches; the live menu decides what is actually worth comparing today."
    },
  },
  {
    "slug": "p60-cannabis-local-visit-guide-2026",
    "title": "P60 Cannabis Menu Guide: Flower, Pre-Rolls, Edibles, THC Vapes and More",
    "seoTitle": "P60 Cannabis Menu Guide | York Weed Store Categories",
    "seo_title": "P60 Cannabis Menu Guide | York Weed Store Categories",
    "metaDescription": "Use this P60 Cannabis menu guide to browse flower sections, pre-rolls, edibles, THC vapes, concentrates, accessories, and store details before visiting.",
    "meta_description": "Use this P60 Cannabis menu guide to browse flower sections, pre-rolls, edibles, THC vapes, concentrates, accessories, and store details before visiting.",
    "h1": "P60 Cannabis Menu Guide: Flower, Pre-Rolls, Edibles, THC Vapes and More",
    "excerpt": "A practical York menu guide for P60 Cannabis, with natural category paths for adults 19+.",
    "authorName": "Weston Jay",
    "authorHandle": "@WestonJay",
    "authorRole": "House Writer",
    "author": "Weston Jay",
    "structuredAuthorName": "P60 Cannabis Editorial Team",
    "date": "2026-07-09",
    "modifiedDate": "2026-07-11",
    "category": "Menu Guide",
    "readTime": "4 min",
    "content": "## P60 Cannabis Menu Guide: Flower, Pre-Rolls, Edibles, THC Vapes and More\n\nA good menu guide should help you choose the first category to check, not make every product type fight for the same click. For P60 Cannabis, start with the question you already have: flower, pre-rolls, edibles, THC vapes, concentrates, accessories, or store details.\n\nIf you are searching for a weed dispensary in York or a weed store in York, use the practical path: confirm the store page, choose the category that matches the visit, then use the live menu or staff for current product details. Menus can change, so this guide stays useful without promising stock.\n\n## Flower, Value, And Premium Browsing\n\nFlower shoppers can start with Budget, AA, AAA+, Premium, or Exotic when those sections are available on the site. Budget is the obvious first stop for cheap weed, affordable weed, or budget weed comparisons. Premium flower and exotic flower belong in their own browsing paths too, because higher-section browsing should still be clear and current, not guessed from an old article.\n\nThe section name is a starting point. Check the live listing for product name, weight, price, and item details before deciding.\n\n## Pre-Rolls, Edibles, THC Vapes, And Concentrates\n\nPre-rolls make sense when you want an already rolled format. Edibles deserve their own page because the comparison is about format and current item details. THC vapes should be checked under the vape category shown by the store, and concentrates should stay separate because they are not just another flower page.\n\nAccessories are separate from cannabis product categories. Keeping them separate makes the menu easier to use and keeps the article honest.\n\n## Confirm Store Details Before You Leave\n\nUse the P60 Cannabis store page for address, directions, phone, hours, and the latest store-specific details before visiting. If one item matters, call or ask staff before leaving. If you are browsing, start broad, narrow the category, and let the current menu answer the final question.\n\n## Simple Next Clicks\n\nStart with the page that matches the visit:\n\n- Flower sections if you are comparing flower.\n- Pre-rolls if convenience is the point.\n- Edibles if format matters.\n- THC vapes if you want the vape category.\n- Concentrates if that is already the product type you know.\n- The store page at /weed-dispensary-york if timing, directions, or contact details come first.\n\nThat is the useful little trick: pick the category first, then compare what is current. The menu gets easier when every category is allowed to do its own job.",
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
      "body": "I would add one simple filter: decide the format before you open the full menu. A shopper looking for cheap weed, pre-rolls, edibles, THC vapes, or concentrates needs different pages, and that first choice keeps the visit from turning into a long scroll."
    },
  }
];

export function getStaticPost(slug: string): StaticBlogPost | undefined {
  return STATIC_POSTS.find((post) => post.slug === slug);
}

export function getBlogRedirect(slug: string): string | undefined {
  return BLOG_REDIRECTS[slug];
}

