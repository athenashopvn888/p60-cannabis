import Link from "next/link";
import { HOME_DELIVERY_CARDS, HOME_DELIVERY_FAQS, HOME_DELIVERY_H2, HOME_DELIVERY_PARAGRAPHS } from "../lib/homeDelivery";
import styles from "./HomeDeliverySection.module.css";

export default function HomeDeliverySection() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_DELIVERY_FAQS.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })),
  };

  return (
    <section className={styles.section} aria-labelledby="home-delivery-heading">
      <div className={styles.inner}>
        <h2 id="home-delivery-heading">{HOME_DELIVERY_H2}</h2>
        {HOME_DELIVERY_PARAGRAPHS.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className={styles.cards}>
          {HOME_DELIVERY_CARDS.map((card) => <Link key={card.href} href={card.href} className={styles.card}><strong>{card.title}</strong><span>{card.text}</span></Link>)}
        </div>
        <h3>York delivery questions</h3>
        {HOME_DELIVERY_FAQS.map((faq) => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\u003c") }} />
    </section>
  );
}
