import Link from "next/link";
import Navbar from "./Navbar";
import Footer from "./Footer";
import styles from "./GBPLandingPage.module.css";
import { DeliveryCoverage } from "./DeliveryCoverage";

const categories = [
  { name: "Exotic Weed", href: "/exotic-weed" },
  { name: "Premium Weed", href: "/premium-weed" },
  { name: "AAA Weed", href: "/aaa-weed" },
  { name: "AA Weed", href: "/aa-weed" },
  { name: "Budget Weed", href: "/budget-weed" },
];

const webPageSchema = {
  "@context": "https://schema.org", "@type": "WebPage",
  "@id": "https://www.p60cannabis.com/weed-dispensary-york#webpage",
  url: "https://www.p60cannabis.com/weed-dispensary-york",
  name: "Weed Dispensary York | P60 Cannabis",
  description: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2. Open 24 hours. Call (289) 217-2763 or view our York store information.",
  about: { "@id": "https://www.p60cannabis.com/#store" },
  breadcrumb: { "@id": "https://www.p60cannabis.com/weed-dispensary-york#breadcrumb" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  "@id": "https://www.p60cannabis.com/weed-dispensary-york#breadcrumb",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.p60cannabis.com/" },
    { "@type": "ListItem", position: 2, name: "Weed Dispensary York", item: "https://www.p60cannabis.com/weed-dispensary-york" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org", "@type": "FAQPage",
  "@id": "https://www.p60cannabis.com/weed-dispensary-york#faq",
  mainEntity: [
    { "@type": "Question", name: "Where is P60 Cannabis located?", acceptedAnswer: { "@type": "Answer", text: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2." } },
    { "@type": "Question", name: "What are the hours for P60 Cannabis?", acceptedAnswer: { "@type": "Answer", text: "P60 Cannabis is open 24 hours." } },
    { "@type": "Question", name: "What is the phone number for P60 Cannabis?", acceptedAnswer: { "@type": "Answer", text: "You can call P60 Cannabis at (289) 217-2763." } },
    { "@type": "Question", name: "Where can I find P60 Cannabis delivery information?", acceptedAnswer: { "@type": "Answer", text: "Delivery hours and listed service areas are available on the dedicated Weed Delivery York page." } },
  ],
};

export function GBPLandingPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([webPageSchema, breadcrumbSchema, faqSchema]).replace(/</g, "\\u003c") }} />
      <Navbar />
      <div className={styles.container}>
        <header className={styles.hero}>
          <h1 className={styles.h1}>Weed Dispensary in York — P60 Cannabis</h1>
          <p className={styles.heroTagline}>P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2.</p>
          <p className={styles.heroTagline}>Our York store is open 24 hours, giving customers the flexibility to visit at the time that works for them.</p>
          <p className={styles.heroTagline}>For questions before your visit, call us at <a href="tel:+12892172763">(289) 217-2763</a>.</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.h2}>Visit P60 Cannabis in York</h2>
          <p className={styles.infoText}>You can find P60 Cannabis at:</p>
          <p className={styles.infoBlock}>1938 Weston Rd<br />York, ON M9N 1W2</p>
          <p className={styles.infoBlock}>Hours: Open 24 hours<br />Phone: <a href="tel:+12892172763">(289) 217-2763</a></p>
          <p className={styles.infoText}>Whether you already know what you want to explore or simply need our store information before visiting, this page gives you the essential details for the P60 Cannabis York location.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Explore Cannabis Categories</h2>
          <p className={styles.infoText}>You can explore the following sections of the P60 Cannabis website:</p>
          <div className={styles.productGrid}>
            {categories.map((category) => <Link key={category.href} href={category.href} className={styles.productCard}><strong>{category.name}</strong><br />Explore our {category.name} section.</Link>)}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Looking for Delivery Information?</h2>
          <p className={styles.infoText}>Delivery details are published separately so you can find the current delivery hours and listed service areas in one place.</p>
          <div className={styles.btnRow}><Link href="/weed-delivery-york" className={`${styles.btn} ${styles.btnPrimary}`}>View Weed Delivery Information</Link></div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>P60 Cannabis York Store Information</h2>
          <p className={styles.infoBlock}>P60 Cannabis<br />1938 Weston Rd<br />York, ON M9N 1W2</p>
          <p className={styles.infoBlock}>Phone: <a href="tel:+12892172763">(289) 217-2763</a><br />Hours: Open 24 hours</p>
          <p className={styles.infoText}>Website: <Link href="/">https://www.p60cannabis.com/</Link></p>
        </section>

        <section id="faq" className={styles.section}>
          <h2 className={styles.h2}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            <div className={styles.faqItem}><h3 className={styles.faqQuestion}>Where is P60 Cannabis located?</h3><p className={styles.faqAnswer}>P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2.</p></div>
            <div className={styles.faqItem}><h3 className={styles.faqQuestion}>What are the hours for P60 Cannabis?</h3><p className={styles.faqAnswer}>P60 Cannabis is open 24 hours.</p></div>
            <div className={styles.faqItem}><h3 className={styles.faqQuestion}>What is the phone number for P60 Cannabis?</h3><p className={styles.faqAnswer}>You can call P60 Cannabis at <a href="tel:+12892172763">(289) 217-2763</a>.</p></div>
            <div className={styles.faqItem}><h3 className={styles.faqQuestion}>Where can I find P60 Cannabis delivery information?</h3><p className={styles.faqAnswer}>Delivery hours and listed service areas are available on the dedicated <Link href="/weed-delivery-york">Weed Delivery York</Link> page.</p></div>
          </div>
        </section>
      </div>
      <DeliveryCoverage />
      <Footer />
    </main>
  );
}
