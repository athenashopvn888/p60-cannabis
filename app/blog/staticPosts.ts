export interface StaticBlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  excerpt: string;
  author: string;
  date: string;
  dateModified: string;
  category: string;
  readTime: string;
  content: string;
  faq: string;
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
  domain: "p60cannabis.com",
  storePath: "/weed-dispensary-york",
};

export const STATIC_POSTS: StaticBlogPost[] = [
  {
    slug: "p60-cannabis-local-visit-guide-adults-19",
    title: "P60 Cannabis Local Visit Guide for Adults 19+",
    seoTitle: "P60 Cannabis Visit Guide for Adults 19+ | York",
    metaDescription:
      "A practical adult 19+ guide to P60 Cannabis in York, with verified address, hours, phone, menu categories, pricing tiers, and useful menu paths.",
    h1: "P60 Cannabis Local Visit Guide for Adults 19+",
    excerpt:
      "A straight, useful guide to checking the P60 Cannabis menu before heading to 1938 Weston Rd in York.",
    author: "P60 Cannabis Team",
    date: "2026-07-10",
    dateModified: "2026-07-10",
    category: "Store Guide",
    readTime: "4 min",
    content: `## The quick read

If you are here for the actual useful bit: P60 Cannabis is at **1938 Weston Rd, York, ON M9N 1W2**. The listed phone number is **(437) 522-2802**, and the site lists the store as open daily from **10:00 AM to 03:00 AM**.

This guide is for Ontario adults 19+. It is not trying to dress up a store page with padded copy. It is here to help you check the right pages before you head out, especially if you already know the kind of product you are browsing for.

## Start with the menu, not the hype

The homepage is the best first stop because it organizes the live shopping paths in one place. Flower is split into clear price tiers: [Exotic flower](/exotic), [Premium flower](/premium), [AAA+ flower](/aaa), [AA flower](/aa), and [Budget flower](/budget).

The site also has separate category pages for [edibles](/items/edibles), [pre-rolls](/items/prerolls), [vape products](/items/vapes), [concentrates](/items/concentrates), [accessories](/items/add-ons), [cigarettes](/items/cigarettes), and [magic items](/items/magic). Category pages are navigation, not a promise that every item is available every minute, so check the current page before making the trip.

## A faster way to browse flower

If you do not feel like scrolling forever, use the tiers as your shortcut. Budget is listed from $3/g, AA from $4/g, AAA+ from $5-$6/g, Premium from $7-$10/g, and Exotic from $10-$12/g.

That is the useful difference between the pages: they let you browse by price lane first, then look at the individual strains inside that lane. Very unglamorous. Very effective.

## Before you leave

Double-check the current menu page, especially if you are looking for one specific item. Bring valid government ID, because this is an adult 19+ store. If you need a yes-or-no answer before travelling, use the listed phone number instead of guessing from an old screenshot or a saved tab.

For store-specific details, use the [P60 Cannabis York store page](/weed-dispensary-york). For the broad menu, start at the [P60 Cannabis homepage](/).`,
    faq: `## FAQ

### Where is P60 Cannabis?

P60 Cannabis is listed at 1938 Weston Rd, York, ON M9N 1W2.

### What hours are listed on the site?

The site lists P60 Cannabis as open daily from 10:00 AM to 03:00 AM.

### Does this guide confirm current stock?

No. It points you to the relevant menu pages. Current item details can change, so use the live pages before visiting.

### What should adults 19+ bring?

Bring valid government identification and check the current store page before heading out.`,
    relatedLinks: [
      {
        title: "P60 Cannabis York store page",
        url: "/weed-dispensary-york",
        description: "Store-specific address, phone, hours, and local details.",
      },
      {
        title: "Browse P60 Cannabis flower tiers",
        url: "/exotic",
        description: "Start with the top flower tier, then move through the menu by price lane.",
      },
      {
        title: "P60 Cannabis edibles menu",
        url: "/items/edibles",
        description: "Useful if you are checking edible categories before visiting.",
      },
    ],
  },
];

export function getStaticPost(slug: string) {
  return STATIC_POSTS.find((post) => post.slug === slug);
}
