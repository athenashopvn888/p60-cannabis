import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./faq.module.css";

export const metadata: Metadata = {
  title: "FAQ — P60 Cannabis | York Dispensary Questions",
  description:
    "Frequently asked questions about P60 Cannabis in York. Hours, location, products, pricing, bundle offers, and everything you need to know before visiting.",
  alternates: {
    canonical: "https://p60cannabis.com/faq",
  },
};

const FAQ_CATEGORIES = [
  {
    title: "📍 Location & Hours",
    faqs: [
      { q: "Where is P60 Cannabis located?", a: "We are located at 1938 Weston Rd, York, ON M9N 1W2. We're easily accessible by TTC bus routes and close to major highways like the 401." },
      { q: "What are your hours?", a: "We are open daily from 10:00 AM to 03:00 AM. Walk in anytime — no appointment needed." },
      { q: "Is there parking nearby?", a: "Yes. Free street parking is available nearby on surrounding streets in the evenings. We're also easily accessible by local transit." },
      { q: "How far are you from Mississauga?", a: "We're just 5 minutes from the highways and central transit routes. We are centrally located and easy to reach." },
      { q: "What's the best way to get to P60 Cannabis?", a: "We're easily accessible by car, bus, or foot. We are easily accessible by car, local transit, or bus routes. Free parking is available on surrounding streets." },
    ],
  },
  {
    title: "🌿 Products & Menu",
    faqs: [
      { q: "What products do you carry?", a: "We carry over 200 strains of cannabis flower across 5 quality tiers (Exotic, Premium, AAA+, AA, Budget), plus edibles (gummies, chocolates, baked goods), vape pens, disposable vapes, concentrates (shatter, wax, hash, diamonds, live resin), pre-rolled joints, native cigarettes, and accessories." },
      { q: "Do you have a live menu?", a: "Yes! Our online menu at p60cannabis.com updates in real time with current stock, prices, THC levels, and availability. You can check what's in stock before you visit." },
      { q: "What are your flower tiers?", a: "Exotic ($10-$12/g, THC 35-39%) — ultra-rare top-shelf genetics. Premium ($7-$10/g, THC 32-34%) — connoisseur-grade. AAA+ ($5-$6/g, THC 30-32%) — heavy hitters, our most popular tier. AA ($4/g, THC 27-29%) — quality daily drivers. Budget ($3/g, THC 24-27%) — reliable value flower." },
      { q: "Do you sell edibles?", a: "Yes! We carry a variety of edibles including gummies, chocolates, baked goods, and more. THC content varies. Check our live menu for current availability." },
      { q: "Do you sell vapes?", a: "Yes — both disposable vapes and refillable vape pens. We carry both nicotine vapes and THC vapes from top brands." },
      { q: "Do you sell native cigarettes?", a: "Yes! We carry one of the widest selections of native cigarettes in downtown York, including premium and value brands in multiple varieties." },
    ],
  },
  {
    title: "💰 Pricing & Bundle Offers",
    faqs: [
      { q: "What is the cheapest weed you sell?", a: "Our Budget tier starts at $3/g with value ounces from $40. Our AA tier is $4/g. These are the most competitive prices you'll find in York." },
      { q: "What bundle pricing do you offer?", a: "Flower bundle pricing includes a 3g total option — the 3g total is shown clearly before purchase. Our Exotic, Premium, and AAA+ tiers also offer 6g bundle pricing, with 6g total pricing." },
      { q: "Do you have ounce deals?", a: "Yes! Budget ounces from $40, AA ounces from $90, AAA+ ounces from $100. All with freshness and quality guaranteed." },
      { q: "How does bundle pricing work?", a: "The 3g bundle pricing applies to every tier automatically. The 6g bundle pricing applies to Exotic, Premium, and AAA+ tiers. These are our standard everyday bundle offers." },
      { q: "How does the tier pricing work?", a: "Each flower strain is graded into one of five quality tiers. The tier determines the per-gram price. This transparent system means you always know exactly what you're paying — no confusing markups or inconsistent pricing." },
    ],
  },
  {
    title: "🛒 Shopping & Experience",
    faqs: [
      { q: "Do I need an appointment?", a: "No! P60 Cannabis is walk-in only. Just show up anytime — we are open daily from 10:00 AM to 03:00 AM." },
      { q: "Can I order online?", a: "Currently, P60 Cannabis is an in-store shopping experience only. You can browse our live menu online to see what's in stock before visiting." },
      { q: "Do you offer delivery?", a: "Delivery is coming soon! Visit our delivery page to sign up for email notifications when we launch our delivery service." },
      { q: "What payment methods do you accept?", a: "We accept cash and debit. No credit cards at this time." },
      { q: "Can your staff help me choose a strain?", a: "Absolutely! Our knowledgeable budtenders are here to help. Whether you're a first-time buyer or a seasoned connoisseur, we can recommend strains based on your preferences, desired effects, and budget." },
      { q: "Is there a minimum purchase?", a: "No minimum purchase required. You can buy as little as 1 gram." },
    ],
  },
];

export default function FAQPage() {
  // JSON-LD for FAQ page
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_CATEGORIES.flatMap((cat) =>
      cat.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      }))
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className={styles.main}>
        <Navbar />

        {/* FAQ Banner */}
        <section className={styles.bannerSection}>
          <img
            src="/banners/p60-real/page-faq.webp"
            alt="P60 Cannabis FAQ — Your Questions Answered"
            className={styles.bannerImg}
          />
        </section>

        <div className={styles.content}>
          <h1 className={styles.pageTitle}>Frequently Asked Questions</h1>
          <p className={styles.pageSubtitle}>
            Everything you need to know about P60 Cannabis — York&apos;s premium dispensary at 1938 Weston Rd in York.
          </p>

          {FAQ_CATEGORIES.map((cat) => (
            <div key={cat.title} className={styles.category}>
              <h2 className={styles.categoryTitle}>{cat.title}</h2>
              {cat.faqs.map((faq) => (
                <details key={faq.q} className={styles.faqItem}>
                  <summary className={styles.faqQuestion}>{faq.q}</summary>
                  <p className={styles.faqAnswer}>{faq.a}</p>
                </details>
              ))}
            </div>
          ))}

          <div className={styles.ctaSection}>
            <h2 className={styles.ctaTitle}>Still have questions?</h2>
            <p className={styles.ctaText}>
              Call us at <strong>(437) 522-2802</strong> or visit us at 1938 Weston Rd, York.
            </p>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}
