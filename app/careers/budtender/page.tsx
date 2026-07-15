import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import BudtenderApplicationForm from "./BudtenderApplicationForm";
import styles from "./budtender.module.css";

export const metadata: Metadata = {
  title: { absolute: "Budtender Or Manager Application | P60 Cannabis" },
  description:
    "Apply online for budtender or manager opportunities at P60 Cannabis in York. Submit availability, experience, motivation, determination, and customer-service answers.",
  alternates: {
    canonical: "https://www.p60cannabis.com/careers/budtender",
  },
};

const applicantFaqs = [
  {
    q: "What kind of person are you looking for?",
    a: "We are looking for motivated, determined people who show up with good energy, learn fast, and care about helping customers feel welcome.",
  },
  {
    q: "Do I need cannabis retail experience?",
    a: "Experience helps, but it is not the whole story. Reliability, confidence, patience, and the drive to learn the menu matter a lot.",
  },
  {
    q: "What should I include in the application?",
    a: "Tell us your real availability, earliest start date, retail background, what motivates you, and why you want to work with P60 Cannabis.",
  },
  {
    q: "Can I call the store about my application?",
    a: "Please apply online only. If we think you may be a good fit, we will contact you after the application is reviewed.",
  },
];

export default function BudtenderCareersPage() {
  return (
    <main className={styles.main}>
      <Navbar />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>P60 Cannabis Careers</span>
            <h1>Budtenders / Managers Wanted</h1>
            <p>
              P60 Cannabis is collecting applications from sharp, friendly budtender and manager candidates who can help customers shop with confidence and keep the store running smooth.
            </p>
            <p className={styles.onlineOnlyNote}>
              Online applications only. Please do not call the store about hiring. If we think you may be a good fit, we will contact you.
            </p>
            <div className={styles.heroActions}>
              <a href="#application" className={styles.primaryAction}>
                Start Application
              </a>
              <Link href="/" className={styles.secondaryAction}>
                Back Home
              </Link>
            </div>
          </div>

          <div className={styles.heroPanel} aria-label="Hiring role snapshot">
            <span className={styles.panelLabel}>Role Snapshot</span>
            <ul>
              <li>Good energy, motivation, and determination</li>
              <li>Customer service, menu curiosity, and clear communication</li>
              <li>Reliability on busy shifts</li>
              <li>Evening or late-shift availability is a plus at P60 Cannabis</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.contentSection}>
        <div className={styles.contentGrid}>
          <aside className={styles.faqPanel}>
            <h2>Applicant Q&amp;A</h2>
            <div className={styles.faqList}>
              {applicantFaqs.map((faq) => (
                <details key={faq.q} className={styles.faqItem}>
                  <summary>{faq.q}</summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </aside>

          <section id="application" className={styles.formPanel} aria-label="Budtender application form">
            <div className={styles.formIntro}>
              <span className={styles.eyebrow}>Apply Now</span>
              <h2>Tell Us About You</h2>
              <p>
                This form sends your response to the shared hiring intake for P60 Cannabis.
              </p>
              <p className={styles.onlineOnlyInline}>
                Online applications only. Please do not call the store about hiring.
              </p>
            </div>
            <BudtenderApplicationForm />
          </section>
        </div>
      </section>

      <Footer />
    </main>
  );
}
