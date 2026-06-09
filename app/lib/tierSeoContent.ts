/* ── Tier-specific SEO content for below-the-fold sections ── */

export interface TierSeoData {
  seoTitle: string;
  seoIntro: string;
  sections: { heading: string; body: string }[];
  faqs: { q: string; a: string }[];
}

export const TIER_SEO: Record<string, TierSeoData> = {
  EXOTIC: {
    seoTitle: "Exotic Cannabis Flower York — Ultra-Rare, Top-Shelf Genetics",
    seoIntro: "Explore the Exotic tier at P60 Cannabis — our most exclusive cannabis flower selection. Hand-picked strains with THC levels up to 39%, stunning bag appeal, and unique terpene profiles you won't find anywhere else in York.",
    sections: [
      {
        heading: "What Makes Exotic Flower Special?",
        body: "Exotic cannabis flower represents the absolute pinnacle of cannabis cultivation. These strains are grown by elite craft cultivators, hand-trimmed to perfection, and selected for their exceptional terpene profiles, bag appeal, and potency. At P60 Cannabis, our Exotic tier features strains with THC levels ranging from 35% to 39% — the highest potency flower available in York.",
      },
      {
        heading: "Exotic Pricing — $20/g with Buy 2g Get 1g FREE",
        body: "Our Exotic flower starts at $20 per gram. With our Buy 2g Get 1g FREE promotion, you get 3 grams for just $40 — that's $13.33/g. For even better value, our Buy 3g Get 3g FREE deal gives you 6 grams for $60 — just $10.00/g. 14g is available for $140 ($10/g) and full ounces (28g) for $250 ($8.93/g).",
      },
      {
        heading: "Why Shop Exotic at P60 Cannabis?",
        body: "P60 Cannabis is located at 1938 Weston Rd in the heart of York's ByWard Market neighbourhood. Our live digital menu is updated in real time, so you can check exactly what Exotic strains are in stock before you visit. Our knowledgeable budtenders can help you find the perfect strain based on your preferred effects, aroma, and potency level.",
      },
    ],
    faqs: [
      { q: "What is Exotic cannabis flower?", a: "Exotic flower is our top-tier cannabis, featuring ultra-rare genetics with THC levels from 35% to 39%. These strains are hand-selected for exceptional bag appeal, unique terpene profiles, and maximum potency." },
      { q: "How much does Exotic flower cost?", a: "Exotic flower is $20/g. With our Buy 2g Get 1g FREE promo, 3g is just $40. Buy 3g Get 3g FREE gives you 6g for $60. 14g is $140 and 28g is $250." },
      { q: "What strains are available in the Exotic tier?", a: "Our Exotic selection rotates frequently. Check our live online menu for the current strains in stock — it updates in real time." },
      { q: "Is Exotic worth the price?", a: "If you value the highest potency, rarest genetics, and best bag appeal, Exotic is absolutely worth it. Our promos bring the per-gram price down significantly — as low as $8.93/g for an ounce." },
    ],
  },

  PREMIUM: {
    seoTitle: "Premium Cannabis Flower York — Hand-Picked Connoisseur Grade",
    seoIntro: "Shop Premium cannabis flower at P60 Cannabis, York. Connoisseur-grade strains with THC 32-34%, exceptional flavour, and smooth smoke. Starting at $15/g.",
    sections: [
      {
        heading: "What is Premium Cannabis Flower?",
        body: "Premium flower sits just below Exotic in our quality hierarchy. These are connoisseur-grade strains with THC levels between 32% and 34%, offering exceptional flavour, smooth smoke, and consistent potency. Premium is the sweet spot for cannabis enthusiasts who want top-quality flower without the Exotic price tag.",
      },
      {
        heading: "Premium Pricing — $15/g with FREE Gram Promos",
        body: "Premium flower starts at $15 per gram. Our Buy 2g Get 1g FREE promo gets you 3 grams for $30 ($10/g). The Buy 3g Get 3g FREE deal delivers 6 grams for just $45 ($7.50/g). 14g is available for $100 ($7.14/g) and 28g for $180 ($6.43/g).",
      },
      {
        heading: "Best Value in ByWard Market",
        body: "At P60 Cannabis on York St, our Premium tier offers the best quality-to-price ratio in the neighbourhood. Every strain in this tier has been personally vetted by our team for potency, flavour, and bag appeal.",
      },
    ],
    faqs: [
      { q: "What is Premium cannabis flower?", a: "Premium is our connoisseur-grade tier featuring strains with THC 32-34%. Hand-picked for exceptional flavour, smooth smoke, and consistent quality." },
      { q: "How much does Premium flower cost?", a: "Premium starts at $15/g. Buy 2g Get 1g FREE = $30/3g. Buy 3g Get 3g FREE = $45/6g. 14g = $100. 28g = $180." },
      { q: "What's the difference between Exotic and Premium?", a: "Exotic features ultra-rare genetics with THC 35-39%, while Premium offers excellent connoisseur-grade strains at THC 32-34% — still top-shelf, but at a lower price point." },
    ],
  },

  "AAA+": {
    seoTitle: "AAA+ Cannabis Flower York — Heavy Hitters at Great Prices",
    seoIntro: "Shop AAA+ cannabis flower at P60 Cannabis, York. Strong, reliable strains with THC 30-32% starting at just $10/g. The best value for experienced smokers.",
    sections: [
      {
        heading: "What is AAA+ Cannabis Flower?",
        body: "AAA+ is where potency meets value. These heavy-hitting strains deliver THC levels from 30% to 32%, making them perfect for daily smokers who want solid potency without paying the premium markup. AAA+ flower at P60 Cannabis is sourced from trusted Canadian craft growers.",
      },
      {
        heading: "AAA+ Pricing — $10/g with Massive Promos",
        body: "AAA+ flower starts at just $10 per gram. Our Buy 2g Get 1g FREE promo delivers 3 grams for $20 ($6.67/g). The Buy 3g Get 3g FREE deal gives you 6 grams for $30 — just $5.00/g. 14g is $60 ($4.29/g) and full ounces (28g) start at $100 ($3.57/g).",
      },
    ],
    faqs: [
      { q: "What is AAA+ cannabis flower?", a: "AAA+ is our value-potency tier featuring strains with THC 30-32%. Heavy hitters with proven genetics at unbeatable prices." },
      { q: "How much does AAA+ flower cost?", a: "AAA+ starts at $10/g. Buy 2g Get 1g FREE = $20/3g. Buy 3g Get 3g FREE = $30/6g. 14g = $60. 28g from $100." },
      { q: "Is AAA+ good quality?", a: "Absolutely. AAA+ strains deliver THC 30-32% with excellent potency and smoke quality. They're the best value-to-potency ratio in our lineup." },
    ],
  },

  AA: {
    seoTitle: "AA Cannabis Flower York — Quality Daily Drivers",
    seoIntro: "Shop AA cannabis flower at P60 Cannabis, York. Solid everyday strains with THC 27-29% at just $5/g. Perfect for regular smokers on a budget.",
    sections: [
      {
        heading: "What is AA Cannabis Flower?",
        body: "AA flower is designed for the everyday smoker. These quality daily drivers deliver consistent THC levels between 27% and 29%, providing reliable effects at an affordable price. AA is perfect for regular smokers who want quality without overspending.",
      },
      {
        heading: "AA Pricing — $5/g, Buy 2g Get 1g FREE",
        body: "AA flower is just $5 per gram. Our Buy 2g Get 1g FREE promo gets you 5 grams for $20 ($4.00/g). 14g is available for $50 ($3.57/g) and 28g for $90 ($3.21/g). Great value for daily use.",
      },
    ],
    faqs: [
      { q: "What is AA cannabis flower?", a: "AA is our everyday-value tier with strains at THC 27-29%. Reliable quality at an affordable price point." },
      { q: "How much does AA flower cost?", a: "AA starts at $5/g. Buy 2g Get 1g FREE = $20/5g ($4.00/g). 14g = $50. 28g = $90." },
    ],
  },

  BUDGET: {
    seoTitle: "Budget Cannabis York — Cheap Weed From $3/g",
    seoIntro: "Cheap weed in York starting at $3/g. P60 Cannabis Budget tier features shreds and value ounces for cost-conscious smokers. Open daily on York St.",
    sections: [
      {
        heading: "Affordable Cannabis Without Compromise",
        body: "Our Budget tier proves that affordable cannabis doesn't mean low quality. With THC levels from 24% to 27%, these value strains deliver solid effects at rock-bottom prices. Whether you're looking for shreds or value ounces, P60 Cannabis has the cheapest weed in York's ByWard Market neighbourhood.",
      },
      {
        heading: "Budget Pricing — From $3/g, OZs from $40",
        body: "Budget flower starts at just $3 per gram. Value ounces start from $40 — some of the best prices you'll find in York. Our Buy 2g Get 1g FREE promo applies here too, giving you even more savings.",
      },
    ],
    faqs: [
      { q: "What is the cheapest weed at P60 Cannabis?", a: "Our Budget tier starts at $3/g with value ounces from $40. These are quality strains at the lowest possible price." },
      { q: "Is budget flower still good quality?", a: "Yes! Budget strains still deliver THC 24-27%. They're perfect for daily smokers who want value without sacrificing potency." },
      { q: "Do you have shreds?", a: "Yes, our Budget tier includes shredded flower options — great for rolling and value pricing." },
    ],
  },
};
