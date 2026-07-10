"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import styles from "./blogpost.module.css";
import { getStaticPost, STORE_BLOG_CONFIG, type StaticBlogPost } from "../staticPosts";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySrZYxI-NNnXfxY1jXOqHgT2HQi4zst2Fgte6FXTeymat_W_r0o1E3P83EfnVCjEk0/exec";

interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  content: string;
  author?: string;
  date?: string;
  dateModified?: string;
  h1?: string;
  excerpt?: string;
  metaDescription?: string;
  faq?: string;
  internal_links_used?: string;
  relatedLinks?: StaticBlogPost["relatedLinks"];
}

function cleanInternalHref(value: string) {
  const href = value.trim();
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("..") || href.includes("\\") || /[\s<>]/.test(href)) {
    return "";
  }
  return href;
}

function parseRelatedLinkLine(line: string) {
  const markdown = line.trim().match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
  if (!markdown) return null;
  const href = cleanInternalHref(markdown[2]);
  return href ? { title: markdown[1].trim(), url: href, description: "Helpful store navigation." } : null;
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
      const href = cleanInternalHref(match[4]);
      nodes.push(href ? <Link key={`link-${match.index}`} href={href}>{match[3]}</Link> : match[3]);
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

export default function PostContent() {
  const params = useParams();
  const slug = params.slug as string;
  const staticPost = getStaticPost(slug);
  const [post, setPost] = useState<BlogPost | null>(staticPost || null);
  const [loading, setLoading] = useState(!staticPost);

  useEffect(() => {
    if (staticPost) return;

    fetch(`${APPS_SCRIPT_URL}?action=blog&store=${STORE_BLOG_CONFIG.storeCode}`)
      .then((r) => r.json())
      .then((data) => {
        const posts = Array.isArray(data.posts) ? data.posts : [];
        const found = posts.find((p: BlogPost) => p.slug === slug);
        setPost(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, staticPost]);

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.loading}>Loading post...</div>
        </div>
        <Footer />
      </main>
    );
  }

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
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.h1 || post.title,
    description: post.metaDescription || post.excerpt || `Read ${post.title} from ${STORE_BLOG_CONFIG.storeName}.`,
    author: {
      "@type": "Organization",
      name: post.author || `${STORE_BLOG_CONFIG.storeName} Team`,
    },
    publisher: {
      "@type": "Organization",
      name: STORE_BLOG_CONFIG.storeName,
    },
    datePublished: post.date,
    dateModified: post.dateModified || post.date,
    mainEntityOfPage: `https://${STORE_BLOG_CONFIG.domain}/blog/${post.slug}`,
  };

  return (
    <main className={styles.main}>
      <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
      <Navbar />
      <article className={styles.content}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/blog">Blog</Link>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{post.title}</span>
        </nav>

        <header className={styles.header}>
          <h1 className={styles.title}>{post.h1 || post.title}</h1>
          <div className={styles.meta}>
            <span>{post.author || `${STORE_BLOG_CONFIG.storeName} Team`}</span>
            <span>-</span>
            <span>
              {post.date
                ? new Date(post.date).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Store guide"}
            </span>
          </div>
        </header>

        <div className={styles.body}>
          {renderContent(post.content)}
        </div>

        {post.faq && (
          <div className={styles.body}>
            {renderContent(post.faq)}
          </div>
        )}

        {relatedLinks.length > 0 && (
          <section className={styles.relatedLinks}>
            <h2 className={styles.contentH2}>Keep browsing</h2>
            <ul className={styles.relatedList}>
              {relatedLinks.map((link) => (
                <li key={link.url}>
                  <Link href={link.url}>{link.title}</Link>
                  <p>{link.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.cta}>
          <p>
            <strong>{STORE_BLOG_CONFIG.storeName}</strong> - check current store details before visiting.
          </p>
          <Link href="/exotic" className={styles.ctaBtn}>Browse Our Menu</Link>
        </div>

        <Link href="/blog" className={styles.backLink}>Back to Blog</Link>
      </article>
      <Footer />
    </main>
  );
}
