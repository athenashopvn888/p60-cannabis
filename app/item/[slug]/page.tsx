import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { allItems, CATEGORY_CONFIG, type ItemProduct } from "../../lib/products";
import { getItemData } from "../../lib/itemData";
import Magnifier from "../../components/Magnifier";
import styles from "../../flower/[slug]/flower.module.css";

/* -- Pre-generate all item pages -- */
export function generateStaticParams() {
  return allItems.map((i) => ({ slug: i.slug }));
}

/* -- SEO metadata per item -- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = allItems.find((i) => i.slug === slug);
  if (!item) return {};

  const itemData = getItemData(item.category, item.name);

  return {
    title: `${item.name} | ${item.category} | P60 Cannabis York`,
    description: itemData.metaDescription,
    alternates: {
      canonical: `https://p60cannabis.com/item/${slug}`,
    },
    openGraph: {
      title: `${item.name} | P60 Cannabis`,
      description: itemData.metaDescription,
      images: item.image ? [{ url: item.image, width: 800, height: 800, alt: item.name }] : [],
    },
  };
}

/* -- JSON-LD Structured Data -- */
function getJsonLd(item: ItemProduct) {
  const itemData = getItemData(item.category, item.name);
  const priceNum = item.price ? parseFloat(item.price.replace('$', '')) : 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    image: item.image,
    description: itemData.description,
    brand: { "@type": "Brand", name: "P60 Cannabis" },
    sku: item.sku,
    offers: {
      "@type": "Offer",
      price: priceNum || 0,
      priceCurrency: "CAD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "P60 Cannabis" },
    },
  };
}

/* -- Breadcrumb JSON-LD -- */
function getBreadcrumbJsonLd(item: ItemProduct) {
  const catSlug = item.category.toLowerCase().replace(' ', '-');
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
        "name": item.category,
        "item": `https://p60cannabis.com/items/${catSlug}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": item.name,
        "item": `https://p60cannabis.com/item/${item.slug}`
      }
    ]
  };
}

/* -- Page -- */
export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = allItems.find((i) => i.slug === slug);
  if (!item) notFound();

  const catInfo = Object.values(CATEGORY_CONFIG).find(c => c.name.toUpperCase() === item.category.toUpperCase() || c.name === item.category);
  const catColor = catInfo?.color || "#94a3b8";
  const catIcon = catInfo?.icon || "🏷️";
  
  const itemData = getItemData(item.category, item.name);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getJsonLd(item)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getBreadcrumbJsonLd(item)) }}
      />

      <main className={styles.main}>
        <Navbar />

        <div className={styles.content}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumb}>
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href={`/items/${catInfo?.slug || item.category.toLowerCase().replace(' ', '-')}`}>{item.category}</Link>
            <span>/</span>
            <span className={styles.breadcrumbCurrent}>{item.name}</span>
          </nav>

          <div className={styles.layout}>
            {/* -- Image -- */}
            <div className={styles.imageWrap}>
              {item.image ? (
                <Magnifier src={item.image} alt={item.name} className={styles.image} />
              ) : (
                <div className={styles.imagePlaceholder}>{item.name[0]}</div>
              )}

              {/* Badges on image */}
              <div className={styles.imageTags}>
                {item.promoImage && (
                  <span className={styles.hotTag}>PROMO</span>
                )}
              </div>
            </div>

            {/* -- Details -- */}
            <div className={styles.details}>
              <div className={styles.tierBadge} style={{ color: catColor, borderColor: `${catColor}33`, background: `${catColor}10` }}>
                {catIcon} {item.category}
              </div>

              <h1 className={styles.strainName}>{item.name}</h1>

              {/* Item info - clean aligned layout */}
              <div className={styles.strainMeta}>
                {item.type && (
                  <>
                    <div className={styles.strainMetaItem}>
                      <span className={styles.strainMetaLabel}>Type</span>
                      <span className={styles.strainMetaValue}>{item.type}</span>
                    </div>
                    <div className={styles.strainMetaDivider} />
                  </>
                )}
                
                {item.thc && (
                  <>
                    <div className={styles.strainMetaItem}>
                      <span className={styles.strainMetaLabel}>THC</span>
                      <span className={styles.strainMetaValueGreen}>{item.thc}</span>
                    </div>
                    <div className={styles.strainMetaDivider} />
                  </>
                )}
                
                {item.mg && (
                  <>
                    <div className={styles.strainMetaItem}>
                      <span className={styles.strainMetaLabel}>MG</span>
                      <span className={styles.strainMetaValueGreen}>{item.mg}</span>
                    </div>
                    <div className={styles.strainMetaDivider} />
                  </>
                )}
                
                <div className={styles.strainMetaItem}>
                  <span className={styles.strainMetaLabel}>SKU</span>
                  <span className={styles.strainMetaValue}>{item.sku}</span>
                </div>
              </div>

              {/* Effects */}
              <div className={styles.effectsRow}>
                {itemData.effects.map((e) => (
                  <span key={e.label} className={styles.effectPill}>
                    {e.emoji} {e.label}
                  </span>
                ))}
              </div>

              {/* -- Pricing table (Single unit for items) -- */}
              <div className={styles.pricingSection}>
                <h2 className={styles.pricingTitle}>Pricing</h2>
                <div className={styles.priceTable}>
                  <div className={styles.priceTableHeader}>
                    <span>UNIT</span>
                    <span>PRICE</span>
                  </div>
                  
                  <div className={styles.priceTableRow}>
                    <span className={styles.priceWeight}>1 Item</span>
                    <span className={styles.priceRegular}>
                      {item.price?.startsWith('$') ? item.price : `$${item.price}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* -- Description (SEO) -- */}
              <div className={styles.descSection}>
                <h2 className={styles.descTitle}>About {item.name}</h2>
                <p className={styles.descText}>{itemData.description}</p>
              </div>

              {/* -- How to consume -- */}
              <div className={styles.descSection} style={{ marginTop: '24px' }}>
                <h2 className={styles.descTitle}>How to Consume</h2>
                <p className={styles.descText}>{itemData.consume}</p>
              </div>

              <div className={styles.visitCta}>
                <p>Available in-store &middot; Walk-in welcome &middot; No appointment needed</p>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </>
  );
}
