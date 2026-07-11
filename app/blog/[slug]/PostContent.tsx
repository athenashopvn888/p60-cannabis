import type { ReactNode } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import styles from "./blogpost.module.css";
import { getStaticPost, STORE_BLOG_CONFIG, type StaticBlogPost } from "../staticPosts";

interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  seo_title?: string;
  meta_description?: string;
  h1?: string;
  content: string;
  faq?: string;
  internal_links_used?: string;
  author?: string;
  authorName?: string;
  authorHandle?: string;
  authorRole?: string;
  structuredAuthorName?: string;
  date?: string;
  modifiedDate?: string;
  category?: string;
  relatedLinks?: StaticBlogPost["relatedLinks"];
  editorialRemark?: StaticBlogPost["editorialRemark"];
}

type PostContentProps = {
  managerPost?: BlogPost | null;
  slug: string;
  storeCode?: string;
  storeName?: string;
  ctaLine?: string;
  isManagerPreview?: boolean;
};

function formatDate(value?: string) {
  if (!value) return "Store post";
  return new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function cleanInternalHref(value: string) {
  const href = value.trim();
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("..") || href.includes("\\") || /[\s<>]/.test(href)) return "";
  return href;
}

function parseRelatedLinkLine(line: string) {
  const markdown = line.trim().match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
  if (!markdown) return null;
  const href = cleanInternalHref(markdown[2]);
  return href ? { title: markdown[1].trim(), url: href, description: "Store-scoped internal link." } : null;
}

function relatedLinksForPost(post: BlogPost) {
  if (post.relatedLinks?.length) return post.relatedLinks;
  return (post.internal_links_used || "")
    .split("\n")
    .map(parseRelatedLinkLine)
    .filter((link): link is NonNullable<ReturnType<typeof parseRelatedLinkLine>> => Boolean(link))
    .slice(0, 6);
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\((\/[^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(<span key={"text-" + lastIndex}>{text.slice(lastIndex, match.index)}</span>);
    if (match[2]) {
      nodes.push(<strong key={"bold-" + match.index}>{match[2]}</strong>);
    } else if (match[3] && match[4]) {
      nodes.push(<Link key={"link-" + match.index} href={match[4]} className={styles.contentLink}>{match[3]}</Link>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(<span key={"text-" + lastIndex}>{text.slice(lastIndex)}</span>);
  return nodes.length ? nodes : text;
}

function renderContent(raw: string) {
  return raw.split("\n\n").map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("## ")) return <h2 key={i} className={styles.contentH2}>{renderInline(trimmed.replace("## ", ""))}</h2>;
    if (trimmed.startsWith("### ")) return <h3 key={i} className={styles.contentH3}>{renderInline(trimmed.replace("### ", ""))}</h3>;
    if (trimmed.startsWith("- ")) {
      const items = trimmed.split("\n").filter((line) => line.trim().startsWith("- "));
      return <ul key={i} className={styles.contentList}>{items.map((item, j) => <li key={j}>{renderInline(item.replace(/^-\s*/, ""))}</li>)}</ul>;
    }
    return <p key={i} className={styles.contentP}>{renderInline(trimmed)}</p>;
  });
}

function bylineName(post: BlogPost, storeName: string) {
  return post.authorName || post.author || "The " + storeName + " Team";
}

function blogPostingJsonLd(post: BlogPost, storeName: string) {
  const title = post.h1 || post.title;
  const description = post.meta_description || title + " from " + storeName + ".";
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished: post.date,
    dateModified: post.modifiedDate || post.date,
    mainEntityOfPage: "https://" + STORE_BLOG_CONFIG.domain + "/blog/" + post.slug,
    author: {
      "@type": "Organization",
      name: post.structuredAuthorName || storeName + " Editorial Team",
    },
    publisher: {
      "@type": "Organization",
      name: storeName,
      url: "https://" + STORE_BLOG_CONFIG.domain,
    },
  };
}

function RelatedAnchor({ link }: { link: StaticBlogPost["relatedLinks"][number] }) {
  if (link.url.startsWith("/")) return <Link href={link.url}>{link.title}</Link>;
  return <a href={link.url}>{link.title}</a>;
}

export default function PostContent({ managerPost = null, slug, storeName = STORE_BLOG_CONFIG.storeName, ctaLine, isManagerPreview = false }: PostContentProps) {
  const post = getStaticPost(slug) || managerPost;
  if (!post) return null;

  const relatedLinks = relatedLinksForPost(post);
  const jsonLd = blogPostingJsonLd(post, storeName);

  return (
    <main className={styles.main}>
      <Navbar />
      <article className={styles.content}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/blog">Blog</Link>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{post.title}</span>
        </nav>

        {isManagerPreview && (
          <div className={styles.previewNotice}>
            <strong>Manager preview</strong>
            <span>This preview is visible only while signed in.</span>
          </div>
        )}

        <header className={styles.header}>
          <p className={styles.kicker}>{post.category || "Store Guide"}</p>
          <h1 className={styles.title}>{post.h1 || post.title}</h1>
          <div className={styles.meta}>
            <span>By {bylineName(post, storeName)} {post.authorHandle ? <><span aria-hidden="true">{"\u00b7"}</span> {post.authorHandle}</> : null}</span>
            <span>{post.authorRole || "House Writer"}</span>
            <span>Published {formatDate(post.date)}</span>
            {post.modifiedDate && <span>Updated {formatDate(post.modifiedDate)}</span>}
          </div>
        </header>

        <div className={styles.body}>{renderContent(post.content)}</div>

        {post.editorialRemark && (
          <aside className={styles.editorialRemark}>
            <p className={styles.remarkLabel}>{post.editorialRemark.label}</p>
            <p className={styles.remarkByline}>
              {post.editorialRemark.authorName} <span aria-hidden="true">{"\u00b7"}</span> {post.editorialRemark.authorHandle}
              <span>{post.editorialRemark.authorRole}</span>
            </p>
            <p>{post.editorialRemark.body}</p>
          </aside>
        )}

        {post.faq && <div className={styles.body}>{renderContent(post.faq)}</div>}

        {relatedLinks.length > 0 && (
          <section className={styles.relatedLinks}>
            <h2 className={styles.contentH2}>Useful next clicks</h2>
            <ul className={styles.relatedList}>
              {relatedLinks.map((link) => (
                <li key={link.url}>
                  <RelatedAnchor link={link} />
                  <p>{link.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.cta}>
          <p><strong>{storeName}</strong> - check the live store page for current address, hours, phone, and menu details before visiting.</p>
          {ctaLine && <p>{ctaLine}</p>}
          <Link href={STORE_BLOG_CONFIG.storePath} className={styles.ctaBtn}>Store Page</Link>
        </div>

        <Link href="/blog" className={styles.backLink}>Back to Blog</Link>
      </article>
      <Footer />
    </main>
  );
}
