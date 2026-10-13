import Link from "next/link";

type CategoryCoreBannersProps = { kind: "weed" | "vapes" | "cigarettes" };

const STORE_NAME = "P60 Cannabis";
const STORE_AREA = "Weston Road, York";
const STORE_ORIGIN = "https://www.p60cannabis.com";
const TOP_WEED_IMAGE = "/banners/core-top-weed-tier.webp";
const CIGARETTE_IMAGE = "/banners/native-cigarette-offer-20260822.webp";
const VAPE_IMAGE = "/banners/core-vapes-nicotine-thc.webp";
const PREMIUM_CIGARETTE_IMAGE = "/banners/core-premium-bb-marlboro-belmont.webp";

export const cigaretteCategoryImage = {
  alt: `${STORE_NAME} in ${STORE_AREA} — 2 packs for $5 mix and match and $25 carton cigarette offer`,
  title: `${STORE_NAME} cigarette offer — 2 packs $5 mix and match, $25 carton`,
};

const promos = {
  weed: { image: TOP_WEED_IMAGE, href: "/exotic-weed", alt: `${STORE_NAME} in ${STORE_AREA} — Exotic, Premium and AAA+ top weed tiers`, title: `${STORE_NAME} top weed tiers — Exotic, Premium and AAA+`, caption: "Exotic, Premium and AAA+ weed", linkLabel: "Shop weed tiers", schemaName: `${STORE_NAME} top weed tiers`, schemaDescription: `Exotic, Premium and AAA+ weed tiers at ${STORE_NAME} in ${STORE_AREA}.` },
  vapes: { image: VAPE_IMAGE, href: "/items/vapes", alt: `${STORE_NAME} in ${STORE_AREA} — nicotine vapes and THC vapes`, title: `${STORE_NAME} nicotine vapes and THC vapes`, caption: "Nicotine vapes + THC vapes", linkLabel: "Shop vapes", schemaName: `${STORE_NAME} nicotine and THC vapes`, schemaDescription: `Nicotine vapes and THC vapes at ${STORE_NAME} in ${STORE_AREA}.` },
  cigarettes: { image: CIGARETTE_IMAGE, href: "/items/cigarettes", alt: cigaretteCategoryImage.alt, title: cigaretteCategoryImage.title, caption: "2 packs $5 mix & match · $25 carton", linkLabel: "Shop cigarettes", schemaName: `${STORE_NAME} cigarette mix and match`, schemaDescription: `Two packs for $5 mix and match and $25 carton cigarette offer at ${STORE_NAME} in ${STORE_AREA}.` },
  premium: { image: PREMIUM_CIGARETTE_IMAGE, href: "/items/cigarettes", alt: `${STORE_NAME} in ${STORE_AREA} — BB Full Flavor and Lights 2 packs for $5, Marlboro and Belmont $10 per pack`, title: `${STORE_NAME} premium cigarettes — BB 2 packs $5, Marlboro and Belmont $10 per pack`, caption: "BB Full Flavor + Lights — 2 packs $5 · Marlboro & Belmont — $10/pack", linkLabel: "Shop cigarettes", schemaName: `${STORE_NAME} premium cigarette offer`, schemaDescription: `BB Full Flavor and Lights two packs for $5 plus Marlboro and Belmont for $10 per pack at ${STORE_NAME} in ${STORE_AREA}.` },
} as const;

const figureStyle = { margin: 0, width: "100%" } as const;
const imageStyle = { display: "block", width: "100%", maxWidth: "100%", height: "auto" } as const;
const captionStyle = { margin: 0, padding: "14px 18px", background: "#111827", color: "#ffffff", textAlign: "center" as const, fontSize: "clamp(17px, 1.7vw, 28px)", fontWeight: 800, lineHeight: 1.35 };
const captionLinkStyle = { color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" } as const;

function PromoFigure({ promo, renderImage = true }: { promo: (typeof promos)[keyof typeof promos]; renderImage?: boolean }) {
  return (
    <figure data-category-core-banner={promo === promos.premium ? "premium-cigarettes" : promo === promos.cigarettes ? "cigarettes" : promo === promos.vapes ? "vapes" : "weed"} style={figureStyle}>
      {renderImage ? <Link href={promo.href} aria-label={promo.alt} style={{ display: "block", width: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={promo.image} alt={promo.alt} title={promo.title} style={imageStyle} loading="lazy" />
      </Link> : null}
      <figcaption style={captionStyle}>{promo.caption} · <Link href={promo.href} style={captionLinkStyle}>{promo.linkLabel}</Link></figcaption>
    </figure>
  );
}

export default function CategoryCoreBanners({ kind }: CategoryCoreBannersProps) {
  const visiblePromos = kind === "cigarettes" ? [promos.cigarettes, promos.premium] : [promos[kind]];
  const imageObjects = visiblePromos.map((promo) => ({ "@type": "ImageObject", name: promo.schemaName, description: promo.schemaDescription, contentUrl: `${STORE_ORIGIN}${promo.image}`, caption: promo.schemaDescription }));
  return (
    <section data-category-core-promos={kind} aria-label={`${STORE_NAME} ${kind} promotions`} style={{ width: "100%", maxWidth: "100%", overflowX: "hidden", marginBottom: "24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": imageObjects }).replace(/</g, "\\u003c") }} />
      {kind === "cigarettes" ? <PromoFigure promo={promos.cigarettes} renderImage={false} /> : <PromoFigure promo={promos[kind]} />}
      {kind === "cigarettes" ? <PromoFigure promo={promos.premium} /> : null}
    </section>
  );
}
