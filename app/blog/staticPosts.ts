export interface StaticBlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  seo_title: string;
  metaDescription: string;
  meta_description: string;
  h1: string;
  excerpt: string;
  author: string;
  date: string;
  category: string;
  readTime: string;
  content: string;
  faq: string;
  internal_links_used: string;
  relatedLinks: Array<{
    title: string;
    url: string;
    description: string;
  }>;
}

export const STORE_BLOG_CONFIG = {
  storeCode: "PNY01",
  storeName: "P60 Cannabis",
  city: "York",
  domain: "www.p60cannabis.com",
  storePath: "/weed-dispensary-york",
};

export const STATIC_POSTS: StaticBlogPost[] = [
  {
    slug: "p60-cannabis-york-store-guide",
    title: "P60 Cannabis Local Store Guide for Adults 19+",
    seoTitle: "P60 Cannabis Guide | York Adult 19+",
    seo_title: "P60 Cannabis Guide | York Adult 19+",
    metaDescription: "Adult 19+ guide to P60 Cannabis around Weston Road / York, with local store-page checks, menu-category context, and safe visit planning.",
    meta_description: "Adult 19+ guide to P60 Cannabis around Weston Road / York, with local store-page checks, menu-category context, and safe visit planning.",
    h1: "P60 Cannabis Local Store Guide for Adults 19+",
    excerpt: "P60 Cannabis guide for adults 19+ reviewing store information around Weston Road / York.",
    author: "The P60 Cannabis Team",
    date: "2026-07-02",
    category: "Store Guide",
    readTime: "4 min",
    content: `## P60 Cannabis Local Store Guide for Adults 19+

P60 Cannabis serves adults 19+ looking for store information around Weston Road / York. Use this guide to get oriented, compare the store page with menu categories, and choose the most useful next step before visiting.

P60 Cannabis is the PNY01 storefront identity. This article must stay separate from Planet 60 Cannabis and Planets 59 Cannabis.

The focus is practical and store-specific: confirm the right storefront, browse helpful category links, and use the store page for directions, contact options, and visit planning.

## Why Local Context Helps

P60 Cannabis is tied to Weston Road and York context in York. Useful local content should make the page easier for shoppers to understand by connecting the store to nearby streets, neighbourhood language, and visit-planning details already supported by the site.

Searchers often want to confirm that they are looking at the right storefront before they visit. A concise guide can support that decision by explaining the local context and the most helpful next steps.

## Plan A Better Visit

Start with the official P60 Cannabis store page, then use the menu/category links to browse what the site makes easy to compare. Shoppers can confirm the right storefront, directions, contact options, and local visit details in one place.

If you need a quick answer before heading out, check the store page first and contact the store directly for help from staff.

## Browse Menu Categories With Confidence

Menu category labels help adults 19+ move quickly from general store research to the product areas they care about. Use them to compare the sections already shown on the site, such as flower, pre-rolls, vapes, edibles, concentrates, accessories, or other store categories.

That makes the page easier to scan and gives shoppers a cleaner path from local research to the right store page.

## Adult 19+ Visit Basics

Adults 19+ should bring valid government identification, confirm the store page before leaving, and use the menu/category links to narrow down what they want to ask about in-store.

The goal is simple: help real shoppers feel confident they are on the right store site and know where to find the next useful page.

## FAQ

### Is this guide for P60 Cannabis only?

Yes. This guide is written for P60 Cannabis and the local York context connected to this website.

### How can shoppers check current menu details?

Use the store page and menu/category links before visiting, then ask staff if you need help comparing options.

### Who can use this guide?

This guide is for adults 19+ who want to understand the store page before visiting.

### What is the best next step after reading?

Open the store page, browse the available menu/category sections, and use the contact or directions options when you are ready to plan your visit.`,
    faq: "",
    internal_links_used: "[P60 Cannabis York store page](/weed-dispensary-york)\\n[P60 Cannabis homepage](/)\\n[More P60 Cannabis guides](/blog)",
    relatedLinks: [
      {
            "title": "P60 Cannabis York store page",
            "url": "https://p60cannabis.com/weed-dispensary-york",
            "description": "Primary store-specific destination for current store details after reading the guide."
      },
      {
            "title": "P60 Cannabis homepage",
            "url": "https://p60cannabis.com/",
            "description": "Store-scoped general navigation for adults 19+."
      },
      {
            "title": "More P60 Cannabis guides",
            "url": "https://p60cannabis.com/blog",
            "description": "Store-scoped blog index for future approved posts."
      }
],
  },
  {
    slug: "p60-cannabis-price-flower-tier-guide",
    title: "P60 Cannabis Price and Flower Tier Guide",
    seoTitle: "P60 Cannabis Price Tier Guide",
    seo_title: "P60 Cannabis Price Tier Guide",
    metaDescription: "P60 Cannabis guide to flower tiers, weight choices, unit value, and store visit planning in York.",
    meta_description: "P60 Cannabis guide to flower tiers, weight choices, unit value, and store visit planning in York.",
    h1: "P60 Cannabis Price and Flower Tier Guide",
    excerpt: "A simple guide to P60 Cannabis flower tiers, weights, and unit value.",
    author: "The P60 Cannabis Team",
    date: "2026-07-09",
    category: "Price Guide",
    readTime: "4 min",
    content: `## P60 Cannabis Price and Flower Tier Guide

P60 Cannabis makes flower shopping easier by organizing the menu into clear tiers. Start with the tier that matches the kind of flower you want, then choose the weight that fits your budget and visit.

The simple idea is: pick the grade, compare the weight, and use the live menu before you head in. Larger weights usually improve unit value, so both the total price and the price per gram are worth checking.

## Start With A Tier

Use these tier pages when you want to compare the menu directly:

- [Exotic flower](/exotic): a top-shelf lane for shoppers who want the highest tier first.
- [Premium flower](/premium): a strong middle-to-top lane for shoppers balancing quality and value.
- [AAA+ flower](/aaa): a simple quality lane with easy weight comparisons.
- [AA flower](/aa): a value-focused lane for straightforward everyday browsing.
- [Budget flower](/budget): the clearest low-cost lane when price is the main priority.

Once the tier feels right, the live menu helps shoppers compare the current strains and weights inside that tier.

## How The Weight Ladder Helps Value

Moving up in weight usually improves the unit value. That means the shopper can look beyond the total price and see how the price per gram changes as the amount gets larger.

Current tier examples commonly shown across the store menu include:

- Exotic flower: 1g at $20/g; 3g at $40, about $13.33/g; 6g at $60, about $10/g.
- Premium flower: 1g at $15/g; 3g at $30, about $10/g; 6g at $45, about $7.50/g.
- AAA+ flower: 1g at $10/g; 3g at $20, about $6.67/g; 6g at $30, about $5/g.
- AA flower: a simple value tier around $4/g where listed on the menu.
- Budget flower: a low-cost lane around $3/g or $10/3g where listed on the menu.

That structure keeps the buying path easy: choose the grade, choose the weight, and compare the unit value before visiting.

## Match The Visit To The Budget

If the goal is the smallest spend, start with the smaller weight options. If you already know the tier you like, compare the next weight step and see how much the unit value improves. If you want a stronger flower lane, stay in Premium or Exotic and compare from there.

This is why a tiered menu works well for local storefront shopping. It keeps the decision organized, makes value easier to understand, and gives shoppers better questions to ask staff when they visit.

## Use The Live Menu Before Visiting

For the smoothest visit, open the P60 Cannabis menu before heading out. The live menu is the best place to compare current flower tiers, weights, and store-specific options. The store page is also useful for directions, contact details, and visit planning.

If you are comparing flower tiers in York, use this page as the simple guide, then use the live menu for the current selection.

## Helpful Next Steps

- Compare [Exotic flower](/exotic), [Premium flower](/premium), [AAA+ flower](/aaa), [AA flower](/aa), and [Budget flower](/budget).
- Open the P60 Cannabis store page for directions, contact details, and visit planning.
- Use the blog index for more store-specific guides.

## FAQ

### How do I choose the right flower tier?

Start with the grade that fits the visit, then compare the weight options inside that tier. This makes it easier to balance quality, amount, and budget.

### Why does unit value matter?

Unit value shows the approximate price per gram at different weights. It helps shoppers see how value changes as they move from 1g to larger options like 3g or 6g.

### Why link to each tier page?

Each tier page gives shoppers a faster path to the exact flower lane they want instead of forcing everyone through the full menu first.

### Where should shoppers check current strains?

Use the live menu for current store-specific selection, then use the store page for directions, contact details, and visit planning.`,
    faq: "",
    internal_links_used: "[Exotic flower](/exotic)\\n[Premium flower](/premium)\\n[AAA+ flower](/aaa)\\n[AA flower](/aa)\\n[Budget flower](/budget)\\n[P60 Cannabis store page](/weed-dispensary-york)",
    relatedLinks: [
      {
        title: "Exotic flower",
        url: "https://p60cannabis.com/exotic",
        description: "Top-shelf flower tier for quick comparison."
      },
      {
        title: "Premium flower",
        url: "https://p60cannabis.com/premium",
        description: "Premium flower tier for quality and value comparison."
      },
      {
        title: "AAA+ flower",
        url: "https://p60cannabis.com/aaa",
        description: "AAA+ flower tier for easy weight comparisons."
      },
      {
        title: "AA flower",
        url: "https://p60cannabis.com/aa",
        description: "AA flower tier for straightforward value browsing."
      },
      {
        title: "Budget flower",
        url: "https://p60cannabis.com/budget",
        description: "Budget flower tier for low-cost browsing."
      },
      {
        title: "P60 Cannabis store page",
        url: "https://p60cannabis.com/weed-dispensary-york",
        description: "Store-specific page for directions, contact details, and visit planning."
      }
    ]
  },
];
export function getStaticPost(slug: string) {
  return STATIC_POSTS.find((post) => post.slug === slug);
}
