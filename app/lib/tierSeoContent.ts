export interface TierSeoData {
  seoTitle: string;
  seoIntro: string;
  sections: { heading: string; body: string }[];
  faqs: { q: string; a: string }[];
}

export const TIER_SEO: Record<string, TierSeoData> = {
  EXOTIC: {
    seoTitle: "Exotic Cannabis Flower York | P60 Cannabis",
    seoIntro: "Use the Exotic flower page at P60 Cannabis to compare current higher-tier flower listings in York.",
    sections: [
      {
        heading: "Start With The Exotic Tier",
        body: "Exotic is the higher-tier flower path on the P60 Cannabis menu. Use the current product name, strain notes, size, posted price, and selection details before choosing.",
      },
      {
        heading: "Check Current Bundle Notes",
        body: "The site may show gram and bundle notes for this tier. Confirm current pricing and selection on the menu or with staff before purchase.",
      },
      {
        heading: "Visit P60 Cannabis On Weston Rd",
        body: "P60 Cannabis is located at 1938 Weston Rd in York. Use the store page for directions, contact options, and listed hours.",
      },
    ],
    faqs: [
      { q: "What is the Exotic flower tier?", a: "Exotic is the higher-tier flower category on the P60 Cannabis menu. Check current listings for today's options." },
      { q: "How should shoppers compare Exotic flower?", a: "Compare the current item name, size, posted price, and menu notes, then ask staff if one detail matters." },
      { q: "Are Exotic listings always the same?", a: "No. Flower listings can rotate, so use the current menu before visiting." },
    ],
  },
  PREMIUM: {
    seoTitle: "Premium Cannabis Flower York | P60 Cannabis",
    seoIntro: "Use the Premium flower page at P60 Cannabis to compare current higher-shelf flower listings in York.",
    sections: [
      {
        heading: "Compare Premium Flower Clearly",
        body: "Premium sits below Exotic in the flower navigation. It is a useful category for York shoppers who want to compare higher-shelf listings without starting at the top tier.",
      },
      {
        heading: "Read The Current Item Notes",
        body: "Use the current menu for strain names, sizes, posted prices, and selection. Menu details can change, so old examples should not make the decision.",
      },
      {
        heading: "Premium Flower On Weston Rd",
        body: "P60 Cannabis is at 1938 Weston Rd in York. Use the store page and current menu together when planning the visit.",
      },
    ],
    faqs: [
      { q: "What is Premium flower at P60 Cannabis?", a: "Premium is one of the flower tiers on the P60 Cannabis menu. Use current listings to compare listed options." },
      { q: "How is Premium different from Exotic?", a: "They are separate menu tiers. Compare the current products and posted details in each tier before choosing." },
      { q: "Where can shoppers confirm current prices?", a: "Use the current menu or ask staff for current product and price details." },
    ],
  },
  "AAA+": {
    seoTitle: "AAA+ Cannabis Flower York | P60 Cannabis",
    seoIntro: "Use the AAA+ flower page at P60 Cannabis to compare current mid-to-high flower listings in York.",
    sections: [
      {
        heading: "Use AAA+ For A Focused Comparison",
        body: "AAA+ is a flower tier for shoppers who want to compare stronger menu listings without mixing every flower category together.",
      },
      {
        heading: "Compare Size, Price, And Notes",
        body: "Start with the current product name, then compare size, posted price, and listing details. If selection or format matters, confirm before visiting.",
      },
    ],
    faqs: [
      { q: "What is AAA+ flower?", a: "AAA+ is one of the P60 Cannabis flower tiers. Check the current menu for today's listings." },
      { q: "How should shoppers compare AAA+?", a: "Compare current item names, sizes, posted prices, and menu notes." },
      { q: "Does this page guarantee current selection?", a: "No. Use the current menu or ask staff for current details." },
    ],
  },
  AA: {
    seoTitle: "AA Cannabis Flower York | P60 Cannabis",
    seoIntro: "Use the AA flower page at P60 Cannabis to compare current everyday flower listings in York.",
    sections: [
      {
        heading: "AA Flower For Everyday Browsing",
        body: "AA is a value-minded flower category on the P60 Cannabis menu. It helps shoppers compare current listings without jumping across every tier.",
      },
      {
        heading: "Confirm The Current Details",
        body: "Use the menu or staff for current product names, sizes, posted prices, and selection before choosing.",
      },
    ],
    faqs: [
      { q: "What is AA flower?", a: "AA is one of the P60 Cannabis flower tiers for shoppers comparing current value-minded listings." },
      { q: "Where should shoppers confirm AA pricing?", a: "Use the current menu or ask staff for today's posted pricing." },
    ],
  },
  BUDGET: {
    seoTitle: "Budget Cannabis York | P60 Cannabis",
    seoIntro: "Use the Budget flower page at P60 Cannabis to compare lower-spend flower listings in York.",
    sections: [
      {
        heading: "Start Here For Lower-Spend Flower",
        body: "The Budget tier is for York shoppers comparing lower-spend flower options around Weston Rd. Start with the current menu and confirm today's product details before choosing.",
      },
      {
        heading: "Check Sizes And Posted Prices",
        body: "Budget listings can change. Compare the current size, posted price, and listing details, then ask staff if one detail decides the visit.",
      },
    ],
    faqs: [
      { q: "What is the Budget flower tier?", a: "Budget is the lower-spend flower category on the P60 Cannabis menu." },
      { q: "Does this page guarantee current Budget listings?", a: "No. Use the current menu or ask staff for current details." },
      { q: "Where is P60 Cannabis?", a: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." },
    ],
  },
};
