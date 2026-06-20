export interface ItemEffects {
  effects: { emoji: string; label: string }[];
  description: string;
  metaDescription: string;
  consume: string;
}

export function getItemData(category: string, name: string): ItemEffects {
  const cat = category.toUpperCase();

  if (cat === "EDIBLES") {
    return {
      effects: [
        { emoji: "🕒", label: "Long Lasting" },
        { emoji: "😌", label: "Body High" },
        { emoji: "🍬", label: "Flavorful" },
      ],
      description: `${name} is a premium cannabis edible available at P60 Cannabis. Made with high-quality distillate or full-spectrum extract, it provides a consistent, long-lasting, and discreet experience. Perfect for those who prefer not to smoke while still enjoying the full benefits of cannabis.`,
      metaDescription: `Buy ${name} cannabis edibles in York at P60 Cannabis. Consistent, discreet, and long-lasting effects. Walk-ins welcome. Open Daily: 10:00 AM - 03:00 AM.`,
      consume: "Start low and go slow. We recommend starting with 5-10mg of THC. Edibles can take 45 to 120 minutes to take full effect. Wait at least 2 hours before consuming more.",
    };
  }

  if (cat.includes("VAPE")) {
    return {
      effects: [
        { emoji: "💨", label: "Fast Acting" },
        { emoji: "⚡", label: "Potent" },
        { emoji: "🤫", label: "Discreet" },
      ],
      description: `${name} is a high-quality vape product available at P60 Cannabis. Designed for convenience and discretion, this vape delivers smooth, flavorful vapor and rapid effects. Engineered for reliability, it ensures a premium experience from the first pull to the last.`,
      metaDescription: `Shop ${name} vape pens and cartridges in York at P60 Cannabis. Fast-acting and potent. Walk-ins welcome. Open Daily: 10:00 AM - 03:00 AM.`,
      consume: "Take 1-2 small puffs and wait 10-15 minutes to gauge the effects before consuming more. Do not chain-vape to avoid burning the coil.",
    };
  }

  if (cat === "CONCENTRATES") {
    return {
      effects: [
        { emoji: "🚀", label: "Highly Potent" },
        { emoji: "⚡", label: "Fast Acting" },
        { emoji: "💎", label: "Pure" },
      ],
      description: `${name} is a premium cannabis concentrate known for its exceptional purity and potency. Crafted using advanced extraction techniques, it preserves the rich terpene profile of the original strain for maximum flavor and effect. Available now at P60 Cannabis.`,
      metaDescription: `Buy ${name} cannabis concentrate in York at P60 Cannabis. Highly potent and pure extracts. Walk-ins welcome. Open Daily: 10:00 AM - 03:00 AM.`,
      consume: "Best consumed using a dab rig, concentrate pen, or by sprinkling a small amount over flower. Due to its high potency, start with an extremely small amount (the size of a grain of rice).",
    };
  }

  if (cat === "PREROLLS") {
    return {
      effects: [
        { emoji: "🌿", label: "Classic High" },
        { emoji: "⏱️", label: "Quick Onset" },
        { emoji: "🤝", label: "Shareable" },
      ],
      description: `${name} is a ready-to-smoke pre-roll made from premium cannabis flower. Perfectly ground and expertly rolled for a smooth, even burn every time. Skip the rolling and enjoy a high-quality smoke straight out of the tube.`,
      metaDescription: `Get ${name} pre-rolled joints in York at P60 Cannabis. Premium flower, perfectly rolled. Walk-ins welcome. Open Daily: 10:00 AM - 03:00 AM.`,
      consume: "Light the end evenly while rotating the joint to prevent canoeing. Take smooth, slow inhales. Wait 10-15 minutes after a few puffs to gauge the effects.",
    };
  }

  if (cat === "MAGIC & OTHERS") {
    return {
      effects: [
        { emoji: "🌀", label: "Specialty" },
        { emoji: "🧠", label: "Mind Expanding" },
        { emoji: "✨", label: "Euphoric" },
      ],
      description: `${name} is a premium specialty product curated for quality and consistency. Whether you are careful use for mental clarity or exploring a deeper journey, this product delivers a reliable and profound experience.`,
      metaDescription: `Shop ${name} specialty specialty items in York at P60 Cannabis. High quality and consistent. Walk-ins welcome. Open Daily: 10:00 AM - 03:00 AM.`,
      consume: "For careful use, consume 0.1g - 0.3g. For a full experience, start with 1g - 2g. Always consume in a safe, comfortable environment. Effects can take 30-90 minutes to onset.",
    };
  }

  // Fallback for Add-Ons, Cigarettes, etc.
  return {
    effects: [
      { emoji: "⭐", label: "Premium Quality" },
      { emoji: "✅", label: "Reliable" },
    ],
    description: `${name} is a top-quality product available right now at P60 Cannabis. We source only the best products to ensure our customers are fully satisfied.`,
    metaDescription: `Buy ${name} in York at P60 Cannabis. Premium quality and best prices. Walk-ins welcome. Open Daily: 10:00 AM - 03:00 AM.`,
    consume: "Use as directed on the packaging.",
  };
}
