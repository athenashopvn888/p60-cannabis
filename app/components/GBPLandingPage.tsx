import Link from "next/link";
import styles from "./GBPLandingPage.module.css";
import { gbpLocation } from "../lib/gbp-location";

// Dictionary mapping category names to their respective paths
const categoryLinks: { [key: string]: string } = {
  "Flower": "/",
  "Pre-rolls": "/items/prerolls",
  "Edibles": "/items/edibles",
  "THC vapes": "/items/vape-disposables",
  "Concentrates": "/items/concentrates",
  "Shatter": "/items/concentrates",
  "CBD oils": "/items/concentrates",
  "Accessories": "/items/add-ons"
};
type StoreSchemaMarkup = {
  "@context": string;
  "@type": string;
  name: string;
  url: string;
  telephone: string;
  address: {
    "@type": string;
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  openingHours?: string[];
  geo?: {
    "@type": string;
    latitude: number;
    longitude: number;
  };
};

export function GBPLandingPage() {
  const categoryGuideLinks = gbpLocation.products.slice(0, 6).map((product) => ({
    label: product,
    href: categoryLinks[product] || "/"
  }));
  // Generate schema.org markup dynamically
  const schemaMarkup: StoreSchemaMarkup = {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": gbpLocation.storeName,
    "url": `https://${gbpLocation.domain}/${gbpLocation.slug}/`,
    "telephone": gbpLocation.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": gbpLocation.streetAddress,
      "addressLocality": gbpLocation.city,
      "addressRegion": gbpLocation.province,
      "postalCode": gbpLocation.postalCode,
      "addressCountry": gbpLocation.country
    }
  };

  // Inject real opening hours and coordinates if they exist
  if (gbpLocation.schemaHours && gbpLocation.schemaHours.length > 0) {
    schemaMarkup.openingHours = gbpLocation.schemaHours;
  }

  if (gbpLocation.latitude && gbpLocation.longitude) {
    schemaMarkup.geo = {
      "@type": "GeoCoordinates",
      "latitude": Number(gbpLocation.latitude),
      "longitude": Number(gbpLocation.longitude)
    };
  }

  return (
    <div className={styles.container}>
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />

      {/* Hero Header */}
      <header className={styles.hero}>
        <h1 className={styles.h1}>{gbpLocation.storeName} — Weed Dispensary in {gbpLocation.city}</h1>
        <p className={styles.heroTagline}>Serving {gbpLocation.city} & Nearby Neighborhoods</p>
      </header>

      <aside className={styles.deliveryNotice} aria-labelledby="landing-delivery-title">
        <h2 id="landing-delivery-title">WEED DELIVERY AVAILABLE</h2>
        <p>P60 Cannabis offers Weed Delivery across York, North York, Vaughan, and Brampton daily from 10 a.m. to 10 p.m. Browse the Weed Delivery menu and use LIVE ORDER to connect with the P60 dispatcher.</p>
      </aside>

      <div className={styles.btnRow}>
        <Link href="/exotic-weed" className={`${styles.btn} ${styles.btnPrimary}`}>STORE MENU</Link>
        <Link href="/weed-delivery-york" className={`${styles.btn} ${styles.btnSecondary}`}>WEED DELIVERY</Link>
      </div>

      {/* Intro Section */}
      <section className={styles.section}>
        <h2 className={styles.h2}>A Local Weed Dispensary</h2>
        <p className={styles.introText}>{gbpLocation.introVariant}</p>
      </section>

      {/* Product Section */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Browse Weed and Cannabis Categories</h2>
        <p className={styles.infoText}>
          At {gbpLocation.storeName}, adults 19+ can browse the following general menu categories. Check the current menu before visiting:
        </p>
        <div className={styles.productGrid}>
          {gbpLocation.products.map((p) => {
            const href = categoryLinks[p] || "/";
            return (
              <Link key={p} href={href} className={styles.productCard}>
                {p}
              </Link>
            );
          })}
        </div>
      </section>
      {/* Visit Planning Section */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Plan a Visit to {gbpLocation.storeName}</h2>
        <p className={styles.infoText}>
          {gbpLocation.storeName} offers adults 19+ a York Weed and cannabis selection across flower, pre-rolls, edibles, THC vapes, concentrates, and other menu categories. Check the current menu for the details shown with each selection.
        </p>
        <p className={styles.infoBlock}>
          Confirm the store address, phone number, listed hours, and current menu details before visiting from elsewhere in {gbpLocation.city}.
        </p>
        <p className={styles.infoText}>
          For a fuller local overview, read the{" "}
          <Link href="/resources">Resources</Link>.
        </p>
      </section>

      {/* Location & NAP Section */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Visit {gbpLocation.storeName} in {gbpLocation.city}</h2>
        <div className={styles.napGrid}>
          <div className={styles.napDetails}>
            <div className={styles.napItem}>
              <span className={styles.napLabel}>Store Name</span>
              <strong>{gbpLocation.storeName}</strong>
            </div>
            <div className={styles.napItem}>
              <span className={styles.napLabel}>Address</span>
              <span>{gbpLocation.address}</span>
            </div>
            <div className={styles.napItem}>
              <span className={styles.napLabel}>Phone</span>
              <span><a href={`tel:${gbpLocation.phoneIntl}`} style={{ color: "inherit" }}>{gbpLocation.phone}</a></span>
            </div>
            <div className={styles.napItem}>
              <span className={styles.napLabel}>Website</span>
              <span><a href={`https://${gbpLocation.domain}/`} style={{ color: "inherit" }}>https://{gbpLocation.domain}/</a></span>
            </div>
            {gbpLocation.hours && gbpLocation.hours.length > 0 && (
              <div className={styles.napItem}>
                <span className={styles.napLabel}>Store Hours</span>
                {gbpLocation.hours.map((line) => (
                  <span key={line} style={{ fontSize: "0.95rem" }}>{line}</span>
                ))}
              </div>
            )}
          </div>
          <div className={styles.mapWrapper}>
            {gbpLocation.mapEmbedUrl ? (
              <iframe
                title={`Map of ${gbpLocation.storeName}`}
                src={gbpLocation.mapEmbedUrl}
                className={styles.mapIframe}
                allowFullScreen={true}
                loading="lazy"
              />
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                Map preview not available.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nearby Areas Section */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Serving Adult Shoppers in York</h2>
        <p className={styles.infoText}>
          P60 Cannabis serves adult shoppers visiting from York and nearby areas. Confirm current directions from your starting point before travelling.
        </p>
      </section>
      {/* Category Link Context Section */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Compare Menu Categories Before You Visit</h2>
        <p className={styles.infoText}>
          These category links help adults 19+ browse general menu sections before visiting. Product selection can change, so use the current menu for current details.
        </p>
        <div className={styles.productGrid}>
          {categoryGuideLinks.map((category) => (
            <Link key={category.label} href={category.href} className={styles.productCard}>
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className={styles.section}>
        <h2 className={styles.h2}>Frequently Asked Questions</h2>
        <div className={styles.faqList}>
          <div className={styles.faqItem}>
            <h3 className={styles.faqQuestion}>How should I plan a visit to {gbpLocation.storeName}?</h3>
            <p className={styles.faqAnswer}>
              Check the store address, phone number, listed hours, and current menu before visiting. {gbpLocation.storeName} serves adults 19+ in {gbpLocation.city}.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3 className={styles.faqQuestion}>Which menu categories can I compare?</h3>
            <p className={styles.faqAnswer}>
              Adults 19+ can compare Weed flower collections, pre-rolls, edibles, Nicotine Vape, THC Vape, concentrates, and other menu categories before checking current details.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3 className={styles.faqQuestion}>Where is {gbpLocation.storeName} located?</h3>
            <p className={styles.faqAnswer}>{gbpLocation.storeName} is located at {gbpLocation.address}.</p>
          </div>
          <div className={styles.faqItem}>
            <h3 className={styles.faqQuestion}>Is {gbpLocation.storeName} a weed dispensary in {gbpLocation.city}?</h3>
            <p className={styles.faqAnswer}>
              {gbpLocation.storeName} serves adults aged 19 and older in {gbpLocation.city}. Bring valid identification and follow applicable laws and product labels.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3 className={styles.faqQuestion}>What products does {gbpLocation.storeName} carry?</h3>
            <p className={styles.faqAnswer}>
              The menu includes Weed flower collections, pre-rolls, edibles, THC Vape, concentrates, and other categories. Check the current menu for product details.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3 className={styles.faqQuestion}>Do I need to be 19+ to shop at {gbpLocation.storeName}?</h3>
            <p className={styles.faqAnswer}>
              Yes, to visit our cannabis store or order from our menu, you must be at least 19 years of age. Valid government-issued photo ID is required for verification.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
