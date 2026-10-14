/** One natural local FAQ question, with its own FAQPage entry. Additive section; text lives in nearMeFaq.json. */
export default function NearMeFaq({ q, a, id }: { q: string; a: string; id: string }) {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", "@id": `#${id}`, mainEntity: [{ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }] };
  return (
    <section id={id} aria-label="Local question" style={{ width: "min(920px, calc(100% - 32px))", margin: "32px auto", padding: "20px 22px", border: "1px solid #dbe7df", borderRadius: 16, background: "#ffffff", color: "#172019" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <details open>
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: "1.05rem" }}>{q}</summary>
        <p style={{ margin: "12px 0 0", lineHeight: 1.7, color: "#46534b" }}>{a}</p>
      </details>
    </section>
  );
}
