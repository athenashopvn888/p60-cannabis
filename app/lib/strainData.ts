/* -- Auto-generated strain effects & SEO descriptions -- */

interface StrainEffects {
  effects: { emoji: string; label: string }[];
  description: string;
  metaDescription: string;
}

const INDICA_EFFECTS = [
  { emoji: "\uD83D\uDECB\uFE0F", label: "Couch Lock" },
  { emoji: "\uD83D\uDE0C", label: "Relax" },
  { emoji: "\uD83C\uDF19", label: "Sleepy" },
];

const SATIVA_EFFECTS = [
  { emoji: "\u26A1", label: "Energize" },
  { emoji: "\uD83C\uDFA8", label: "Creative" },
  { emoji: "\uD83C\uDFAF", label: "Focus" },
];

const HYBRID_EFFECTS = [
  { emoji: "\u2696\uFE0F", label: "Balanced" },
  { emoji: "\uD83D\uDE04", label: "Uplifting" },
  { emoji: "\uD83C\uDF3F", label: "Calm" },
];

const TIER_DESCRIPTIONS: Record<string, string> = {
  EXOTIC: "ultra-rare, top-shelf exotic",
  PREMIUM: "premium connoisseur-grade",
  "AAA+": "heavy-hitting AAA+",
  AA: "quality daily-driver AA",
  BUDGET: "value-packed budget",
};

export function getStrainData(
  name: string,
  type: "indica" | "sativa" | "hybrid",
  tier: string,
  thc: string
): StrainEffects {
  const typeLabel =
    type === "indica" ? "Indica" : type === "sativa" ? "Sativa" : "Hybrid";
  const tierDesc = TIER_DESCRIPTIONS[tier] || tier.toLowerCase();
  const effects =
    type === "indica"
      ? INDICA_EFFECTS
      : type === "sativa"
      ? SATIVA_EFFECTS
      : HYBRID_EFFECTS;

  const description = `${name} is a ${tierDesc} ${typeLabel} strain${
    thc ? ` testing at ${thc} THC` : ""
  }. Known for its ${effects
    .map((e) => e.label.toLowerCase())
    .join(", ")} effects, this ${typeLabel.toLowerCase()} delivers ${
    type === "indica"
      ? "deep body relaxation and a heavy, sedating high perfect for unwinding after a long day"
      : type === "sativa"
      ? "an uplifting cerebral buzz and creative energy ideal for daytime use"
      : "a balanced experience combining physical relaxation with mental clarity"
  }. Available in-store at P60 Cannabis, York.`;

  const metaDescription = `${name} - ${tierDesc} ${typeLabel}${
    thc ? ` at ${thc} THC` : ""
  }. ${
    type === "indica"
      ? "Relaxing body high."
      : type === "sativa"
      ? "Uplifting cerebral buzz."
      : "Balanced hybrid effects."
  } Walk-in welcome at P60 Cannabis York. Real-time stock.`;

  return { effects, description, metaDescription };
}
