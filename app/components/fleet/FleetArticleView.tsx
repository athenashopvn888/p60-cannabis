import { articleJsonLd, type FleetArticle } from "../../lib/fleet/articles";
import { FLEET_ARTICLES_PATH } from "../../lib/fleet/config";

export default function FleetArticleView({ article }: { article: FleetArticle }) {
  return (
    <article data-fleet-article={article.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(article)).replace(/</g, "\\u003c") }} />
      <p><a href={FLEET_ARTICLES_PATH}>Articles</a></p>
      <h1>{article.title}</h1>
      {article.heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.heroImage} alt={article.alt} />
      ) : null}
      <div data-fleet-article-body="" dangerouslySetInnerHTML={{ __html: article.html }} />
      {article.faqs.length > 0 ? (
        <section>
          <h2>Questions</h2>
          {article.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <div dangerouslySetInnerHTML={{ __html: faq.answer }} />
            </details>
          ))}
        </section>
      ) : null}
    </article>
  );
}
