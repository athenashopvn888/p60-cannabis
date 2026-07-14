import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./faq.module.css";

export const metadata: Metadata = {
  title: "FAQ - P60 Cannabis | York Dispensary Questions",
  description:
    "Frequently asked questions about P60 Cannabis in York, including location, listed hours, product categories, menu notes, and delivery updates.",
  alternates: {
    canonical: "https://p60cannabis.com/faq",
  },
};

const FAQ_CATEGORIES = [
  {
    title: "Location & Hours",
    faqs: [
      { q: "Where is P60 Cannabis located?", a: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." },
      { q: "What are your listed hours?", a: "The site lists P60 Cannabis as open daily from 10:00 AM to 03:00 AM." },
      { q: "Is there parking nearby?", a: "Check the store page, local signs, and current street rules before parking. Local transit may also be useful for a Weston Rd visit." },
      { q: "How do I get to P60 Cannabis?", a: "Use the store page or your preferred map app for current directions to 1938 Weston Rd in York." },
    ],
  },
  {
    title: "Products & Menu",
    faqs: [
      { q: "What products do you carry?", a: "The site has menu paths for flower tiers, edibles, vape categories, concentrates, pre-rolls, cigarettes, and accessories. Check the current menu for today's listings." },
      { q: "Do you have a live menu?", a: "Use p60cannabis.com to review current menu details before visiting. Product names, prices, and availability can change." },
      { q: "What are your flower tiers?", a: "Flower is organized by tier: Exotic, Premium, AAA+, AA, and Budget. Use the tier pages to compare current listings." },
      { q: "Do you sell edibles?", a: "The site has an edibles category. Check the current menu for available edible listings." },
      { q: "Do you sell vapes?", a: "The site has vape category pages. Check the current menu for current vape listings and details." },
      { q: "Do you sell native cigarettes?", a: "The site includes a cigarette category. Confirm current cigarette options with the menu or staff." },
    ],
  },
  {
    title: "Pricing & Bundle Notes",
    faqs: [
      { q: "Where should value shoppers start?", a: "Start with Budget and AA flower, then compare current menu details before choosing." },
      { q: "What bundle pricing do you show?", a: "Flower pages may show tier and bundle notes. Confirm current posted pricing in the menu before purchase." },
      { q: "Do you have ounce deals?", a: "Use the current menu or ask staff for today's ounce options and pricing." },
      { q: "How does tier pricing work?", a: "Each flower category is grouped by tier. Use the current listing, size, posted price, and item notes for the final comparison." },
    ],
  },
  {
    title: "Shopping & Experience",
    faqs: [
      { q: "Do I need an appointment?", a: "The public site presents P60 Cannabis as a walk-in store. Check current store details before visiting." },
      { q: "Can I order online?", a: "Use the online menu for browsing. Confirm ordering options and current availability with the store." },
      { q: "Do you offer delivery?", a: "Delivery is listed as coming soon. Visit the delivery page to sign up for updates." },
      { q: "What payment methods do you accept?", a: "Ask staff or check the store page for current payment details before visiting." },
      { q: "Can staff help me choose a product?", a: "Ask staff when a current product detail, format, or category choice needs a real-time answer." },
    ],
  },
];

export default function FAQPage() {
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

        <section className={styles.bannerSection}>
          <img
            src="/banners/p60-real/page-faq.webp"
            alt="P60 Cannabis FAQ"
            className={styles.bannerImg}
          />
        </section>

        <div className={styles.content}>
          <h1 className={styles.pageTitle}>Frequently Asked Questions</h1>
          <p className={styles.pageSubtitle}>
            Store basics for P60 Cannabis at 1938 Weston Rd in York.
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
              Call <strong>(437) 522-2802</strong> or visit 1938 Weston Rd, York.
            </p>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}
