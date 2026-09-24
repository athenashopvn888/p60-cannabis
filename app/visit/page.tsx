import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./visit.module.css";

const ORIGIN = "https://www.p60cannabis.com";
const BRAND = "P60 Cannabis";
const PHONE_DISPLAY = "+1 (289) 217-2763";
const PHONE_INTL = "+12892172763";
const ADDRESS = "1938 Weston Rd, York, ON M9N 1W2";
const HOURS_LABEL = "Open 24 Hours Daily";

export const metadata: Metadata = {
  title: { absolute: "How to Visit P60 Cannabis on Weston Road in York" },
  description: "Walk-in directions for P60 Cannabis at 1938 Weston Rd in York: transit, parking, landmarks, and 19+ ID. Open 24 Hours Daily.",
  alternates: { canonical: `${ORIGIN}/visit` },
  openGraph: {
    title: "How to Visit P60 Cannabis on Weston Road in York",
    description: "Walk-in directions for P60 Cannabis at 1938 Weston Rd in York: transit, parking, landmarks, and 19+ ID. Open 24 Hours Daily.",
    url: `${ORIGIN}/visit`,
  },
};

const VISIT_FAQS = [
  {
    "q": "Where is P60 Cannabis?",
    "a": "1938 Weston Rd, York, ON M9N 1W2. Call +1 (289) 217-2763. Adults 19+."
  },
  {
    "q": "Is the store open 24 hours?",
    "a": "Yes. Hours match the live Google Business Profile: open 24 hours daily. See /hours for the weekly grid."
  },
  {
    "q": "What should I bring?",
    "a": "Government-issued photo ID proving you are 19 or older. Debit and cash are listed in-store payment methods. No appointment."
  },
  {
    "q": "Where should I park?",
    "a": "Use posted street parking on Weston Road and nearby laterals. Read signs; restrictions change by hour. Allow extra time when the frontage is busy."
  }
];

const visitJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Store",
      "@id": `${ORIGIN}/#store`,
      name: BRAND,
      url: ORIGIN,
      telephone: PHONE_INTL,
      address: {
        "@type": "PostalAddress",
        streetAddress: "1938 Weston Rd",
        addressLocality: "York",
        addressRegion: "ON",
        postalCode: "M9N 1W2",
        addressCountry: "CA",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 43.70044,
        longitude: -79.51779,
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
          opens: "00:00",
          closes: "23:59",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${ORIGIN}/visit#faq`,
      mainEntity: VISIT_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq["q"],
        acceptedAnswer: { "@type": "Answer", text: faq["a"] },
      })),
    },
  ],
};

export default function VisitPage() {
  return (
    <main className={styles.main}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(visitJsonLd) }} />
      <Navbar />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Weston Road / York · Adults 19+ · Walk-in · 24/7</p>
          <h1 className={styles.heroTitle}>How to Get to P60 Cannabis on Weston Road</h1>
          <p className={styles.heroLead}>
            Supporting how-to-reach notes for P60 Cannabis at 1938 Weston Rd, York, ON M9N 1W2. NAP, 24/7 hours, and the map hub live on the homepage. Use this page for street-level transit, parking, and landmark notes. Adults 19+.
          </p>
          <div className={styles.napCard}>
            <strong>Address, phone, hours</strong>
            <p>
              {BRAND}
              <br />
              {ADDRESS}
            </p>
            <p>
              Phone: <a href={`tel:${PHONE_INTL}`}>{PHONE_DISPLAY}</a>
            </p>
            <p>{HOURS_LABEL}</p>
            <p>
              <Link href="/hours">Full weekly hours</Link>
            </p>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>Transit on Weston Road and York</h2>
          <p>Weston Road is the spine. Local TTC bus routes that serve Weston Road and the York / Mount Dennis corridor are the most literal transit answer if you are already west of downtown. Ask the operator for stops near 1938 Weston rather than riding past into a different neighbourhood.</p>
          <p>Mount Dennis Station and nearby surface routes are useful planning landmarks, but they are not the storefront. Always check current TTC service, construction, and substitutions before you travel — this page is a planning sketch, not a live vehicle feed.</p>
        </section>

        <section className={styles.section}>
          <h2>Parking near 1938 Weston Rd</h2>
          <p>Street parking along Weston Road and the laterals is the curb pattern. Read posted signs; restrictions rotate by block and by hour. Do not stop in bus bays or clearways just because a previous visit was easy.</p>
          <p>When the frontage is busy, loop side streets one block off Weston rather than circling the same door. This page does not claim a dedicated P60 lot. If an exact stall matters, allow extra time or take transit.</p>
        </section>

        <section className={styles.section}>
          <h2>Landmarks on the Weston Road / York corridor</h2>
          <p>Think of the pin as a Weston Road storefront serving York, Mount Dennis, and the nearby west-end corridors — not a downtown core address.</p>
          <ul>
            <li>Weston Road corridor through York</li><li>Mount Dennis area landmarks to the south</li><li>Eglinton West and Black Creek as neighbouring planning corridors</li><li>Jane Street corridor a short hop east/west depending on your approach</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>What to bring (adults 19+)</h2>
          <p>
            Government-issued photo ID proving you are 19 or older is required.
            Walk-in only — no appointment. Debit and cash are the listed in-store payment methods.
            Hours stay {HOURS_LABEL}.
            If one exact product is the reason for the trip, call {PHONE_DISPLAY} first.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/exotic-weed" className={`${styles.cta} ${styles.ctaPrimary}`}>
              Browse the walk-in menu
            </Link>
            <Link href="/hours" className={`${styles.cta} ${styles.ctaSecondary}`}>
              Store hours
            </Link>
            <a href={`tel:${PHONE_INTL}`} className={`${styles.cta} ${styles.ctaSecondary}`}>
              Call {PHONE_DISPLAY}
            </a>
          </div>
          <p className={styles.ageNote}>Adults 19+. No medical claims. Selection varies.</p>
        </section>

        <section className={styles.section}>
          <h2>Map</h2>
          <p>Search {ADDRESS}. The embed uses that same NAP string.</p>
          <div className={styles.mapWrap}>
            <iframe
              title={`Map of ${BRAND} at ${ADDRESS}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2>Visit FAQs</h2>
          {VISIT_FAQS.map((faq) => (
            <details key={faq.q} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{faq.q}</summary>
              <p className={styles.faqAnswer}>{faq.a}</p>
            </details>
          ))}
        </section>
      </div>
      <Footer />
    </main>
  );
}
