import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./hours.module.css";

const ORIGIN = "https://www.p60cannabis.com";
const PHONE_DISPLAY = "+1 (289) 217-2763";
const PHONE_INTL = "+12892172763";
const ADDRESS = "1938 Weston Rd, York, ON M9N 1W2";
const BRAND = "P60 Cannabis";
const HOURS_LABEL = "Open 24 Hours Daily";

export const metadata: Metadata = {
  title: { absolute: "Store Hours on Weston Road | P60 Cannabis" },
  description: "P60 Cannabis at 1938 Weston Rd in York is open 24 hours daily. Adults 19+. Call +1 (289) 217-2763.",
  alternates: { canonical: `${ORIGIN}/hours` },
  openGraph: {
    title: "Store Hours on Weston Road | P60 Cannabis",
    description: "P60 Cannabis at 1938 Weston Rd in York is open 24 hours daily. Adults 19+. Call +1 (289) 217-2763.",
    url: `${ORIGIN}/hours`,
  },
};

const HOURS_FAQS = [
  { q: "Is P60 Cannabis open 24 hours?", a: "Yes. 1938 Weston Rd is open 24 hours daily per the live Google Business Profile." },
  { q: "What is the address and phone?", a: "1938 Weston Rd, York, ON M9N 1W2. Call +1 (289) 217-2763. Adults 19+." },
  { q: "Where are directions?", a: "Use /visit for Weston Road approach notes. The homepage remains the NAP hub." },
] as const;

const hoursJsonLd = {
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
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          opens: "00:00",
          closes: "23:59",
        },
      ],
    },
    {
      "@type": "WebPage",
      "@id": `${ORIGIN}/hours#webpage`,
      url: `${ORIGIN}/hours`,
      name: "Store Hours on Weston Road | P60 Cannabis",
      description: "P60 Cannabis at 1938 Weston Rd in York is open 24 hours daily. Adults 19+. Call +1 (289) 217-2763.",
      about: { "@id": `${ORIGIN}/#store` },
    },
    {
      "@type": "FAQPage",
      "@id": `${ORIGIN}/hours#faq`,
      mainEntity: HOURS_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ],
};

export default function HoursPage() {
  return (
    <main className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hoursJsonLd) }}
      />
      <Navbar />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>HOURS · ADULTS 19+ · GBP-MATCHED</p>
          <h1 className={styles.heroTitle}>P60 Cannabis Hours — Open 24 Hours on Weston Road in York</h1>
          <p className={styles.heroLead}>
            Published hours for P60 Cannabis at 1938 Weston Rd. The live Google Business Profile lists open 24 hours every day. Adults 19+.
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
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>Weekly hours</h2>
          <p>
            Times match the live Google Business Profile for this location.
            GBP encodes 24-hour days as an empty open time with close hour 24;
            this page publishes {HOURS_LABEL} with schema opens 00:00 and closes 23:59 each day.
          </p>
            <div className={styles.weekRow}><span>Monday</span><strong>{HOURS_LABEL}</strong></div>
            <div className={styles.weekRow}><span>Tuesday</span><strong>{HOURS_LABEL}</strong></div>
            <div className={styles.weekRow}><span>Wednesday</span><strong>{HOURS_LABEL}</strong></div>
            <div className={styles.weekRow}><span>Thursday</span><strong>{HOURS_LABEL}</strong></div>
            <div className={styles.weekRow}><span>Friday</span><strong>{HOURS_LABEL}</strong></div>
            <div className={styles.weekRow}><span>Saturday</span><strong>{HOURS_LABEL}</strong></div>
            <div className={styles.weekRow}><span>Sunday</span><strong>{HOURS_LABEL}</strong></div>
        </section>

        <section className={styles.section}>
          <h2>Walk-in notes</h2>
          <p>
            Transit, parking, and Weston Road landmarks are on /visit. Walk-in only — no appointment.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/visit" className={`${styles.cta} ${styles.ctaPrimary}`}>
              Visit / directions
            </Link>
            <a href={`tel:${PHONE_INTL}`} className={`${styles.cta} ${styles.ctaSecondary}`}>
              Call {PHONE_DISPLAY}
            </a>
          </div>
          <p className={styles.ageNote}>Adults 19+. Government-issued photo ID required. No medical claims.</p>
        </section>

        <section className={styles.section}>
          <h2>Hours FAQs</h2>
          {HOURS_FAQS.map((faq) => (
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
