export interface TierSeoData {
  seoTitle: string;
  seoIntro: string;
  sections: { heading: string; body: string }[];
  faqs: { q: string; a: string }[];
}

export const TIER_SEO: Record<string, TierSeoData> = {
  EXOTIC: {
    seoTitle: "Exotic Weed & Cannabis Flower York",
    seoIntro: "Compare current Exotic Weed flower listings at P60 Cannabis in York, then review each product's listed details.",
    sections: [
      {
        heading: "Compare Exotic Weed Listings",
        body: "Exotic Weed is one of five flower collections at P60 Cannabis. Compare the product name, size, posted price, and listing details before choosing.",
      },
      {
        heading: "Check Current Bundle Notes",
        body: "Product cards may show gram and bundle notes. Confirm current pricing and selection on the menu or with staff before purchase.",
      },
      {
        heading: "Visit P60 Cannabis On Weston Rd",
        body: "P60 Cannabis is located at 1938 Weston Rd in York. Use the store page for directions, contact options, and listed hours.",
      },
    ],
    faqs: [
      { q: "What is the Exotic Weed collection?", a: "Exotic Weed is one of the flower collections on the P60 Cannabis menu. Check current listings for details." },
      { q: "How should shoppers compare Exotic Weed?", a: "Compare the current item name, size, posted price, and menu notes, then ask staff if one detail matters." },
      { q: "Are Exotic Weed listings always the same?", a: "No. Flower listings can rotate, so check the current menu before visiting." },
    ],
  },
  PREMIUM: {
    seoTitle: "Premium Weed & Cannabis Flower York",
    seoIntro: "Compare current Premium Weed flower listings at P60 Cannabis in York, then review each product's listed details.",
    sections: [
      {
        heading: "Compare Premium Weed Listings",
        body: "Premium Weed is a distinct flower collection for York shoppers comparing P60 Cannabis products by name, size, posted price, and listing details.",
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
      { q: "What is Premium Weed at P60 Cannabis?", a: "Premium Weed is one of the flower collections on the P60 Cannabis menu. Use current listings to compare options." },
      { q: "How is Premium Weed different from Exotic Weed?", a: "They are separate flower collections. Compare current products and posted details in each before choosing." },
      { q: "Where can shoppers confirm current prices?", a: "Use the current menu or ask staff for current product and price details." },
    ],
  },
  "AAA+": {
    seoTitle: "AAA+ Weed & Cannabis Flower York",
    seoIntro: "Compare current AAA+ Weed flower listings at P60 Cannabis in York, then review each product's listed details.",
    sections: [
      {
        heading: "Compare AAA+ Weed Listings",
        body: "AAA+ Weed is a distinct flower collection that helps shoppers compare current products without mixing every flower category together.",
      },
      {
        heading: "Compare Size, Price, And Notes",
        body: "Start with the current product name, then compare size, posted price, and listing details. If selection or format matters, confirm before visiting.",
      },
    ],
    faqs: [
      { q: "What is AAA+ Weed?", a: "AAA+ Weed is one of the P60 Cannabis flower collections. Check the current menu for listing details." },
      { q: "How should shoppers compare AAA+ Weed?", a: "Compare current item names, sizes, posted prices, and menu notes." },
      { q: "How can I confirm current AAA+ Weed selection?", a: "Use the current menu or ask staff for current details." },
    ],
  },
  AA: {
    seoTitle: "AA Weed & Cannabis Flower York",
    seoIntro: "Compare current AA Weed flower listings at P60 Cannabis in York, then review each product's listed details.",
    sections: [
      {
        heading: "Compare AA Weed Listings",
        body: "AA Weed is a distinct flower collection on the P60 Cannabis menu. Compare current products by name, size, posted price, and listing details.",
      },
      {
        heading: "Confirm The Current Details",
        body: "Use the menu or staff for current product names, sizes, posted prices, and selection before choosing.",
      },
    ],
    faqs: [
      { q: "What is AA Weed?", a: "AA Weed is one of the P60 Cannabis flower collections for shoppers comparing current listings." },
      { q: "Where should shoppers confirm AA Weed pricing?", a: "Use the current menu or ask staff for current posted pricing." },
    ],
  },
  BUDGET: {
    seoTitle: "Budget Weed & Cannabis Flower York",
    seoIntro: "Compare current Budget Weed flower listings at P60 Cannabis in York, then review each product's listed details.",
    sections: [
      {
        heading: "Compare Budget Weed Listings",
        body: "Budget Weed is a distinct flower collection for York shoppers comparing current products by name, size, posted price, and listing details.",
      },
      {
        heading: "Check Sizes And Posted Prices",
        body: "Budget listings can change. Compare the current size, posted price, and listing details, then ask staff if one detail decides the visit.",
      },
    ],
    faqs: [
      { q: "What is the Budget Weed collection?", a: "Budget Weed is one of the flower collections on the P60 Cannabis menu." },
      { q: "How can I confirm current Budget Weed listings?", a: "Use the current menu or ask staff for current details." },
      { q: "Where is P60 Cannabis?", a: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." },
    ],
  },
};
