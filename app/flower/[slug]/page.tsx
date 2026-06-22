import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { allFlowers, TIER_CONFIG, type FlowerProduct, type PricePoint } from "../../lib/products";
import { getStrainData } from "../../lib/strainData";
import RelatedScroll from "./RelatedScroll";
import Magnifier from "../../components/Magnifier";
import styles from "./flower.module.css";

/* -- Pre-generate all flower pages -- */
export function generateStaticParams() {
  return allFlowers.map((f) => ({ slug: f.slug }));
}

/* -- SEO metadata per strain -- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const flower = allFlowers.find((f) => f.slug === slug);
  if (!flower) return {};

  const tierName = TIER_CONFIG[flower.tier]?.name || flower.tier;
  const strainData = getStrainData(flower.name, flower.type, flower.tier, flower.thc);

  return {
    title: `${flower.name} | ${tierName} ${flower.type === "indica" ? "Indica" : flower.type === "sativa" ? "Sativa" : "Hybrid"} | THC ${flower.thc} | P60 Cannabis York`,
    description: strainData.metaDescription,
    alternates: {
      canonical: `https://p60cannabis.com/flower/${slug}`,
    },
    openGraph: {
      title: `${flower.name} | P60 Cannabis`,
      description: strainData.metaDescription,
      images: flower.image ? [{ url: flower.image, width: 800, height: 800, alt: flower.name }] : [],
    },
  };
}

/* -- JSON-LD Structured Data -- */
function cleanSku(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function getJsonLd(flower: FlowerProduct) {
  const lowestPrice = [flower.price3g, flower.price5g, flower.price14g, flower.price28g]
    .filter((p): p is PricePoint => p !== null)
    .map((p) => p.sale ?? p.regular)
    .sort((a, b) => a - b)[0];

  const strainData = getStrainData(flower.name, flower.type, flower.tier, flower.thc);

  const offers: any = {
    "@type": "Offer",
    url: `https://p60cannabis.com/flower/${flower.slug}`,
    priceCurrency: "CAD",
    availability: "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: "P60 Cannabis" },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "CA",
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted"
    }
  };

  if (lowestPrice !== undefined && lowestPrice !== null) {
    offers.price = lowestPrice;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: flower.name,
    image: flower.image ? [flower.image.startsWith('http') ? flower.image : `https://p60cannabis.com${flower.image.startsWith('/') ? '' : '/'}${flower.image}`] : undefined,
    description: strainData.description,
    brand: { "@type": "Brand", name: "P60 Cannabis" },
    sku: cleanSku(flower.sku || flower.slug),
    offers,
  };
}

/* -- Breadcrumb JSON-LD -- */
function getBreadcrumbJsonLd(flower: FlowerProduct) {
  const tierConfig = TIER_CONFIG[flower.tier];
  const tierSlug = tierConfig?.slug || "exotic";
  const tierName = tierConfig?.name || flower.tier;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://p60cannabis.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": tierName,
        "item": `https://p60cannabis.com/${tierSlug}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": flower.name,
        "item": `https://p60cannabis.com/flower/${flower.slug}`
      }
    ]
  };
}

/* Top 3 tiers get "6g" label (6g bundle pricing), AA stays "5g" */
const TOP_TIERS = ["EXOTIC", "PREMIUM", "AAA+"];

/* -- Page -- */
export default async function FlowerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const flower = allFlowers.find((f) => f.slug === slug);
  if (!flower) notFound();

  const tierConfig = TIER_CONFIG[flower.tier];
  const tierColor = tierConfig?.color || "#94a3b8";
  const tierName = tierConfig?.name || flower.tier;
  const typeName = flower.type === "indica" ? "Indica" : flower.type === "sativa" ? "Sativa" : "Hybrid";
  const strainData = getStrainData(flower.name, flower.type, flower.tier, flower.thc);
  const isTopTier = TOP_TIERS.includes(flower.tier);

  // Weight label for 5g column depends on tier
  const fiveGLabel = isTopTier ? "6g" : "5g";
  const fiveGGrams = isTopTier ? 6 : 5;

  const prices = [
    { label: "3g", grams: 3, p: flower.price3g, promo: "3g bundle pricing" },
    { label: fiveGLabel, grams: fiveGGrams, p: flower.price5g, promo: isTopTier ? "6g bundle pricing" : null },
    { label: "14g", grams: 14, p: flower.price14g, promo: null },
    { label: "28g", grams: 28, p: flower.price28g, promo: null },
  ].filter((x) => x.p !== null);

  // Cheapest per-gram for value display
  const perGram = prices.map(({ grams, p, label }) => {
    if (!p) return null;
    const price = p.sale ?? p.regular;
    return { perG: +(price / grams).toFixed(2), label, price };
  }).filter(Boolean).sort((a, b) => (a?.perG ?? 99) - (b?.perG ?? 99));

  const bestValue = perGram[0];

  // Related strains from same tier
  const related = allFlowers
    .filter((f) => f.tier === flower.tier && f.slug !== flower.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getJsonLd(flower)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getBreadcrumbJsonLd(flower)) }}
      />

      <main className={styles.main}>
        <Navbar />

        <div className={styles.content}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href={`/${tierConfig?.slug || "exotic"}`}>{tierName}</Link>
            <span>/</span>
            <span className={styles.breadcrumbCurrent}>{flower.name}</span>
          </nav>

          <div className={styles.layout}>
            {/* -- Image -- */}
            <div className={styles.imageWrap}>
              {flower.image ? (
                <Magnifier src={flower.image} alt={flower.name} className={styles.image} />
              ) : (
                <div className={styles.imagePlaceholder}>{flower.name[0]}</div>
              )}

              {/* Tags on image */}
              <div className={styles.imageTags}>
                {flower.isSale && (
                  <span className={styles.saleTag}>SALE</span>
                )}
                {flower.isHot && (
                  <span className={styles.hotTag}>HOT</span>
                )}
              </div>

              {/* THC badge on image - always green */}
              <span className={styles.thcOverlay}>THC {flower.thc}</span>
            </div>

            {/* -- Details -- */}
            <div className={styles.details}>
              <div className={styles.tierBadge} style={{ color: tierColor, borderColor: `${tierColor}33`, background: `${tierColor}10` }}>
                {tierConfig?.icon} {tierName}
              </div>

              <h1 className={styles.strainName}>{flower.name}</h1>

              {/* Strain info - clean aligned layout instead of pills */}
              <div className={styles.strainMeta}>
                <div className={styles.strainMetaItem}>
                  <span className={styles.strainMetaLabel}>Type</span>
                  <span className={`${styles.strainMetaValue} ${styles[flower.type]}`}>{typeName}</span>
                </div>
                <div className={styles.strainMetaDivider} />
                <div className={styles.strainMetaItem}>
                  <span className={styles.strainMetaLabel}>THC</span>
                  <span className={styles.strainMetaValueGreen}>{flower.thc}</span>
                </div>
                <div className={styles.strainMetaDivider} />
                <div className={styles.strainMetaItem}>
                  <span className={styles.strainMetaLabel}>SKU</span>
                  <span className={styles.strainMetaValue}>{flower.sku}</span>
                </div>
              </div>

              {/* Effects */}
              <div className={styles.effectsRow}>
                {strainData.effects.map((e) => (
                  <span key={e.label} className={styles.effectPill}>
                    {e.emoji} {e.label}
                  </span>
                ))}
              </div>

              {/* -- Pricing table -- */}
              <div className={styles.pricingSection}>
                <h2 className={styles.pricingTitle}>Pricing</h2>
                <div className={styles.priceTable}>
                  <div className={styles.priceTableHeader}>
                    <span>WEIGHT</span>
                    <span>PRICE</span>
                    <span>$/G</span>
                  </div>
                  {prices.map(({ label, grams, p, promo }) => {
                    const effectivePrice = p ? (p.sale ?? p.regular) : 0;
                    const perG = effectivePrice > 0 ? (effectivePrice / grams).toFixed(2) : "—";
                    return (
                      <div key={label} className={promo ? styles.dealGroup : ""}>
                        {promo && (
                          <div className={styles.dealBanner}>
                            🎁 {promo} = <strong>${effectivePrice} / {label.toUpperCase()}</strong>
                          </div>
                        )}
                        <div className={`${styles.priceTableRow} ${p && p.sale !== null ? styles.priceTableRowSale : ""}`}>
                          <span className={styles.priceWeight}>{label}</span>
                          {p && p.sale !== null ? (
                            <div className={styles.priceSale}>
                              <span className={styles.priceNew}>${p.sale}</span>
                              <span className={styles.priceOld}>${p.regular}</span>
                            </div>
                          ) : (
                            <span className={styles.priceRegular}>
                              ${p?.regular}
                            </span>
                          )}
                          <span className={styles.pricePerGram}>${perG}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {bestValue && (
                  <div className={styles.valueNote}>
                    Best value: <strong>${bestValue.perG}/g</strong> at {bestValue.label}
                  </div>
                )}
              </div>

              {/* -- Description (SEO) -- */}
              <div className={styles.descSection}>
                <h2 className={styles.descTitle}>About {flower.name}</h2>
                <p className={styles.descText}>{strainData.description}</p>
              </div>

              <div className={styles.visitCta}>
                <p>Available in-store &middot; Walk-in welcome &middot; No appointment needed</p>
              </div>
            </div>
          </div>

          {/* -- Related strains -- */}
          {related.length > 0 && (
            <RelatedScroll
              flowers={related.map((r) => ({ sku: r.sku, slug: r.slug, name: r.name, image: r.image, thc: r.thc }))}
              tierName={tierName}
              tierColor={tierColor}
            />
          )}
        </div>

        <Footer />
      </main>
    </>
  );
}
