import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import styles from "../resources.module.css";
import {
  AUTHORS,
  SITE,
  getCategoryPages,
  getChildPages,
  getFeaturedPages,
  getRelatedPages,
  getResourcePageBySlug,
  getStaticResourceParams,
  type ResourcePage,
} from "../resourceData";

type PageParams = Promise<{ slug?: string[] }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return getStaticResourceParams();
}

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getResourcePageBySlug(slug);
  if (!page) return {};

  const canonical = `${SITE.baseUrl}${page.path}`;
  const author = AUTHORS[page.author];

  return {
    title: {
      absolute: page.seoTitle,
    },
    description: page.metaDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      type: page.kind === "article" || page.kind === "update" ? "article" : "website",
      title: page.seoTitle,
      description: page.metaDescription,
      url: canonical,
      siteName: SITE.name,
      images: [
        {
          url: `${SITE.baseUrl}${page.image.src}`,
          width: 1200,
          height: 630,
          alt: page.image.alt,
        },
      ],
      ...(page.kind === "article" || page.kind === "update"
        ? {
            publishedTime: page.datePublished,
            modifiedTime: page.dateModified,
            authors: [author.name],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.seoTitle,
      description: page.metaDescription,
      images: [`${SITE.baseUrl}${page.image.src}`],
    },
  };
}

export default async function ResourceRoute({
  params,
}: {
  params: PageParams;
}) {
  const { slug } = await params;
  const page = getResourcePageBySlug(slug);
  if (!page) notFound();

  const author = AUTHORS[page.author];
  const children = page.kind === "root" ? getCategoryPages() : getChildPages(page.path);
  const featured = page.kind === "root" ? getFeaturedPages() : children;
  const related = getRelatedPages(page);
  const schema = buildSchema(page);

  return (
    <main className={styles.main}>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <section className={styles.hero}>
        <div className={styles.heroMedia}>
          <img src={page.image.src} alt={page.image.alt} className={styles.heroImage} />
          <div className={styles.heroShade} />
        </div>
        <div className={styles.heroContent}>
          <Breadcrumbs page={page} />
          <p className={styles.kicker}>{page.categoryLabel}</p>
          <h1>{page.h1}</h1>
          <p className={styles.heroText}>{page.excerpt}</p>
          <div className={styles.metaRow}>
            <span>{author.name}</span>
            <span>{author.role}</span>
            <span>Updated {formatDate(page.dateModified)}</span>
          </div>
        </div>
      </section>

      <section className={styles.bodyWrap}>
        <article className={styles.article}>
          <div className={styles.introBlock}>
            {page.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {children.length > 0 && (
            <ResourceCards
              title={page.kind === "root" ? "Choose a Resource Lane" : "Guides in This Lane"}
              pages={children}
            />
          )}

          {page.kind === "root" && featured.length > 0 && (
            <ResourceCards title="Featured Resource Reads" pages={featured} compact />
          )}

          {page.sections.map((section) => (
            <section key={section.heading} className={styles.contentSection}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.links && <LinkList links={section.links} />}
            </section>
          ))}

          {page.secondTake && (
            <aside className={styles.secondTake}>
              <h2>A Second Take</h2>
              <div className={styles.takeByline}>
                <strong>{AUTHORS[page.secondTake.author].name}</strong>
                <span>{AUTHORS[page.secondTake.author].handle}</span>
                <span>{AUTHORS[page.secondTake.author].role}</span>
              </div>
              <p>{page.secondTake.body}</p>
            </aside>
          )}

          {page.commercialLinks.length > 0 && (
            <section className={styles.linkPanel}>
              <h2>Current P60 Links</h2>
              <LinkList links={page.commercialLinks} />
            </section>
          )}

          {related.length > 0 && <ResourceCards title="Related Resources" pages={related} compact />}
        </article>

        <aside className={styles.sideRail}>
          <div className={styles.authorCard}>
            <p className={styles.railLabel}>Author</p>
            <strong>{author.name}</strong>
            <span>{author.handle}</span>
            <span>{author.role}</span>
          </div>
          <div className={styles.storeCard}>
            <p className={styles.railLabel}>P60 Cannabis</p>
            <span>{SITE.address}</span>
            <span>{SITE.hours}</span>
            <Link href={SITE.storePage}>View store page</Link>
          </div>
        </aside>
      </section>

      <Footer />
    </main>
  );
}

function Breadcrumbs({ page }: { page: ResourcePage }) {
  const parent = page.parent ? getResourcePageBySlug(page.parent.replace(/^\/resources\/?/, "").split("/")) : undefined;

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <span>/</span>
      <Link href="/resources">Resources</Link>
      {parent && page.path !== parent.path && (
        <>
          <span>/</span>
          <Link href={parent.path}>{parent.title}</Link>
        </>
      )}
    </nav>
  );
}

function ResourceCards({
  title,
  pages,
  compact = false,
}: {
  title: string;
  pages: ResourcePage[];
  compact?: boolean;
}) {
  return (
    <section className={styles.cardsSection}>
      <h2>{title}</h2>
      <div className={compact ? styles.cardGridCompact : styles.cardGrid}>
        {pages.map((page) => {
          const author = AUTHORS[page.author];
          return (
            <Link href={page.path} key={page.path} className={styles.resourceCard}>
              <span className={styles.cardKicker}>{page.categoryLabel}</span>
              <h3>{page.title}</h3>
              <p>{page.excerpt}</p>
              <div className={styles.cardMeta}>
                <span>{author.name}</span>
                <span>Updated {formatDate(page.dateModified)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LinkList({ links }: { links: { label: string; href: string; description?: string }[] }) {
  return (
    <div className={styles.linkList}>
      {links.map((link) => (
        <Link href={link.href} key={`${link.href}-${link.label}`}>
          <span>{link.label}</span>
          {link.description && <small>{link.description}</small>}
        </Link>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function buildSchema(page: ResourcePage) {
  const canonical = `${SITE.baseUrl}${page.path}`;
  const author = AUTHORS[page.author];
  const parent = page.parent ? getResourcePageBySlug(page.parent.replace(/^\/resources\/?/, "").split("/")) : undefined;

  const breadcrumbItems = [
    { name: "Home", item: SITE.baseUrl },
    { name: "Resources", item: `${SITE.baseUrl}/resources` },
    ...(parent && parent.path !== page.path
      ? [{ name: parent.title, item: `${SITE.baseUrl}${parent.path}` }]
      : []),
    { name: page.title, item: canonical },
  ];

  const pageType = page.kind === "article" || page.kind === "update" ? "Article" : "CollectionPage";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.item,
        })),
      },
      {
        "@type": pageType,
        "@id": canonical,
        url: canonical,
        name: page.seoTitle,
        headline: page.h1,
        description: page.metaDescription,
        image: `${SITE.baseUrl}${page.image.src}`,
        author: {
          "@type": "Person",
          name: author.name,
          alternateName: author.handle,
        },
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          logo: {
            "@type": "ImageObject",
            url: `${SITE.baseUrl}/storeFavicon.webp`,
          },
        },
        datePublished: page.datePublished,
        dateModified: page.dateModified,
        mainEntityOfPage: canonical,
      },
    ],
  };
}
