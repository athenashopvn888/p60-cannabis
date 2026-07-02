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
  date?: string;
  relatedLinks?: StaticBlogPost["relatedLinks"];
}

type PostContentProps = {
  managerPost?: BlogPost | null;
  slug: string;
  storeCode?: string;
  storeName?: string;
  ctaLine?: string;
  isManagerPreview?: boolean;
};

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
    .slice(0, 5);
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\((\/[^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    if (match[2]) {
      nodes.push(<strong key={`bold-${match.index}`}>{match[2]}</strong>);
    } else if (match[3] && match[4]) {
      nodes.push(<Link key={`link-${match.index}`} href={match[4]} className={styles.contentLink}>{match[3]}</Link>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  return nodes.length ? nodes : text;
}

function renderContent(raw: string) {
  return raw.split("\n\n").map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("## ")) {
      return <h2 key={i} className={styles.contentH2}>{renderInline(trimmed.replace("## ", ""))}</h2>;
    }
    if (trimmed.startsWith("### ")) {
      return <h3 key={i} className={styles.contentH3}>{renderInline(trimmed.replace("### ", ""))}</h3>;
    }
    if (trimmed.startsWith("- ")) {
      const items = trimmed.split("\n").filter((line) => line.trim().startsWith("- "));
      return (
        <ul key={i} className={styles.contentList}>
          {items.map((item, j) => <li key={j}>{renderInline(item.replace(/^-\s*/, ""))}</li>)}
        </ul>
      );
    }
    return <p key={i} className={styles.contentP}>{renderInline(trimmed)}</p>;
  });
}

export default function PostContent({ managerPost = null, slug, storeName = STORE_BLOG_CONFIG.storeName, ctaLine, isManagerPreview = false }: PostContentProps) {
  const post = getStaticPost(slug) || managerPost;

  if (!post) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.notFound}>
            <h1>Post Not Found</h1>
            <p>This blog post does not exist or has been removed.</p>
            <Link href="/blog" className={styles.backLink}>Back to Blog</Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const relatedLinks = relatedLinksForPost(post);

  return (
    <main className={styles.main}>
      <Navbar />
      <article className={styles.content}>
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
            <span>This draft or scheduled post is visible only while signed in.</span>
          </div>
        )}

        <header className={styles.header}>
          <h1 className={styles.title}>{post.h1 || post.title}</h1>
          <div className={styles.meta}>
            <span>{post.author || "Store team"}</span>
            <span>-</span>
            <span>{post.date ? new Date(post.date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "Store post"}</span>
          </div>
        </header>

        <div className={styles.body}>{renderContent(post.content)}</div>

        {post.faq && <div className={styles.body}>{renderContent(post.faq)}</div>}

        {relatedLinks.length > 0 && (
          <section className={styles.relatedLinks}>
            <h2 className={styles.contentH2}>Helpful next steps</h2>
            <ul className={styles.relatedList}>
              {relatedLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url}>{link.title}</a>
                  <p>{link.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.cta}>
          <p><strong>{storeName}</strong> - use the store page for current store details before visiting.</p>
          {ctaLine && <p>{ctaLine}</p>}
          <Link href={STORE_BLOG_CONFIG.storePath} className={styles.ctaBtn}>Store Page</Link>
        </div>

        <Link href="/blog" className={styles.backLink}>Back to Blog</Link>
      </article>
      <Footer />
    </main>
  );
}
