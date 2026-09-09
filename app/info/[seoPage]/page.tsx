import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import fs from "fs";
import path from "path";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { SEO_PAGES, getSeoPageBySlug } from "../../lib/seoPages";
import { TIER_CONFIG } from "../../lib/products";
import styles from "./seo.module.css";

/* ── Generate all SEO pages ── */
export function generateStaticParams() {
  return SEO_PAGES.map((p) => ({ seoPage: p.slug }));
}

/* ── Metadata ── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ seoPage: string }>;
}): Promise<Metadata> {
  const { seoPage: slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) return {};

  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.metaDescription,
    alternates: {
      canonical: `https://www.p60cannabis.com/info/${slug}`,
    },
  };
}

/* ── Page ── */
export default async function SeoLandingPage({
  params,
}: {
  params: Promise<{ seoPage: string }>;
}) {
  const { seoPage: slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) notFound();

  if (slug === "weed-store-near-toronto") {
    const webPageSchema = {
      "@context": "https://schema.org", "@type": "WebPage",
      "@id": "https://www.p60cannabis.com/info/weed-store-near-toronto#webpage",
      url: "https://www.p60cannabis.com/info/weed-store-near-toronto",
      name: "Visiting P60 Cannabis from Toronto | York Store Information",
      description: "Coming from Toronto? P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2 and is open 24 hours. View our York store information before visiting.",
      about: { "@id": "https://www.p60cannabis.com/#store" },
      breadcrumb: { "@id": "https://www.p60cannabis.com/info/weed-store-near-toronto#breadcrumb" },
    };
    const breadcrumbSchema = {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      "@id": "https://www.p60cannabis.com/info/weed-store-near-toronto#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.p60cannabis.com/" },
        { "@type": "ListItem", position: 2, name: "Visiting P60 Cannabis from Toronto", item: "https://www.p60cannabis.com/info/weed-store-near-toronto" },
      ],
    };
    const faqSchema = {
      "@context": "https://schema.org", "@type": "FAQPage",
      "@id": "https://www.p60cannabis.com/info/weed-store-near-toronto#faq",
      mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })),
    };

    return (
      <main className={styles.main}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([webPageSchema, breadcrumbSchema, faqSchema]).replace(/</g, "\\u003c") }} />
        <Navbar />
        <section className={styles.hero}><div className={styles.heroInner}><span className={styles.heroIcon}>{page.icon}</span><h1 className={styles.heroH1}>{page.h1}</h1><p className={styles.heroTagline}>If you are starting your visit from Toronto, the P60 Cannabis store address is 1938 Weston Rd, York, ON M9N 1W2.</p><p className={styles.heroTagline}>P60 Cannabis is open 24 hours.</p><p className={styles.heroTagline}>For complete information about the York store, including its address, phone number and links to the main cannabis sections of the website, visit our dedicated York store page.</p><Link href="/weed-dispensary-york" className={styles.productHeroPrimary}>View P60 Cannabis York Store</Link></div></section>
        <section className={styles.content}><div className={styles.container}>
          <div className={styles.section}><h2 className={styles.sectionTitle}>P60 Cannabis Store Address</h2><p className={styles.sectionBody}>Use the following address when planning your visit:</p><p className={styles.sectionBody}>P60 Cannabis<br />1938 Weston Rd<br />York, ON M9N 1W2</p><p className={styles.sectionBody}>Hours: Open 24 hours<br />Phone: <a href="tel:+12892172763">(289) 217-2763</a></p></div>
          <div className={styles.section}><h2 className={styles.sectionTitle}>Before You Visit</h2><p className={styles.sectionBody}>P60 Cannabis is open 24 hours at its Weston Road location in York.</p><p className={styles.sectionBody}>If you need to contact the store before visiting, call <a href="tel:+12892172763">(289) 217-2763</a>.</p><p className={styles.sectionBody}>For the full York store page, continue here:</p><Link href="/weed-dispensary-york" className={styles.productHeroPrimary}>P60 Cannabis York Store Information</Link></div>
          <div className={styles.section}><h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>{page.faqs.map((faq) => <details key={faq.q} className={styles.faqItem}><summary className={styles.faqQ}>{faq.q}</summary><p className={styles.faqA}>{faq.a}{faq.q === "Where can I find the complete York store information?" && <> <Link href="/weed-dispensary-york">P60 Cannabis York store page</Link>.</>}</p></details>)}</div>
        </div></section>
        <Footer />
      </main>
    );
  }

  const tiers = Object.values(TIER_CONFIG);
  const heroPreview = page.heroPreview;

  // Check if banner file exists in the public folder
  const bannerExists = page.banner
    ? fs.existsSync(path.join(process.cwd(), "public", page.banner))
    : false;

  return (
    <main className={styles.main}>
      <Navbar />

      {/* Banner Image */}
      {page.banner && bannerExists && !heroPreview && (
        <section className={styles.bannerSection}>
          <img
            src={page.banner}
            alt={page.h1}
            className={styles.bannerImg}
          />
        </section>
      )}

      {/* Hero */}
      {heroPreview ? (
        <section className={`${styles.productHero} ${heroPreview.theme === "nicotine" ? styles.nicotineProductHero : ""}`} data-publication-status="approved">
          <div className={styles.productHeroInner}>
            <div className={styles.productHeroCopy}>
              <span className={styles.productHeroKicker}>{heroPreview.eyebrow}</span>
              <h1>{page.h1}</h1>
              <p>{heroPreview.intro}</p>
              <div className={styles.productHeroActions}>
                <Link href={heroPreview.menuHref ?? "/items/cigarettes"} className={styles.productHeroPrimary}>{heroPreview.primaryLabel ?? "Check the cigarette menu"}</Link>
                <Link href={heroPreview.secondaryHref ?? heroPreview.menuHref ?? "/items/cigarettes"} className={styles.productHeroSecondary}>{heroPreview.secondaryLabel ?? "See the current selection"}</Link>
              </div>
              {heroPreview.identityStrip && <p className={styles.productHeroIdentity}>{heroPreview.identityStrip}</p>}
            </div>
            <div className={styles.productPreviewStage} aria-label={`${page.h1} brand preview`}>
              {heroPreview.products.map((product, index) => (
                <Link key={product.name} href={heroPreview.menuHref ?? "/items/cigarettes"} className={styles.productPreviewCard}>
                  <Image
                    src={product.image}
                    alt={`${product.name} brand preview`}
                    width={800}
                    height={800}
                    priority={index === 0}
                    unoptimized={product.image.startsWith("https://")}
                    sizes="(max-width: 720px) 42vw, (max-width: 980px) 46vw, 220px"
                  />
                  <span>{product.name}</span>
                </Link>
              ))}
              <p className={styles.productHeroDisclosure}>{heroPreview.disclosure}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.heroIcon}>{page.icon}</span>
            <h1 className={styles.heroH1}>{page.h1}</h1>
            <p className={styles.heroTagline}>{page.heroTagline}</p>
          </div>
        </section>
      )}

      {/* Content Sections */}
      <section className={styles.content}>
        <div className={styles.container}>
          {heroPreview?.featuredHeading && heroPreview.featuredIntro && <div className={styles.featuredIntro} id="featured-vapes"><h2>{heroPreview.featuredHeading}</h2><p>{heroPreview.featuredIntro}</p></div>}
          {page.sections.map((s, i) => (
            <div key={i} className={styles.section}>
              <h2 className={styles.sectionTitle}>{s.heading}</h2>
              <p className={styles.sectionBody}>{s.body}</p>
            </div>
          ))}

          {/* Tier Grid */}
          {heroPreview?.theme !== "nicotine" && <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Our Cannabis Menu — Five Tiers of Quality</h2>
            <div className={styles.tierGrid}>
              {tiers.map((tier) => (
                <Link
                  key={tier.slug}
                  href={`/${tier.slug}`}
                  className={styles.tierCard}
                  style={{ "--tier-color": tier.color } as React.CSSProperties}
                >
                  <div className={styles.tierLabel} style={{ color: tier.color }}>
                    {tier.icon} {tier.name}
                  </div>
                  <div className={styles.tierPrice}>${tier.unitPrice}/g</div>
                  <p className={styles.tierDesc}>{tier.tagline}</p>
                  <span className={styles.tierLink}>Browse {tier.name} →</span>
                </Link>
              ))}
            </div>
          </div>}

          {/* Map */}
          {heroPreview?.theme !== "nicotine" && <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Find Us</h2>
            <div className={styles.mapWrap}>
            </div>
            <div className={styles.visitBtns}>
            </div>
          </div>}

          {/* FAQ */}
          {page.faqs.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
              {page.faqs.map((faq, i) => (
                <details key={i} className={styles.faqItem}>
                  <summary className={styles.faqQ}>{faq.q}</summary>
                  <p className={styles.faqA}>{faq.a}</p>
                </details>
              ))}
            </div>
          )}
          {heroPreview?.warning && <p className={styles.nicotineWarning}>{heroPreview.warning}</p>}
        </div>
      </section>

      <Footer />
    </main>
  );
}
