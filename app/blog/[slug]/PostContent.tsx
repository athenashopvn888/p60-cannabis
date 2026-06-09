"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import styles from "./blogpost.module.css";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySrZYxI-NNnXfxY1jXOqHgT2HQi4zst2Fgte6FXTeymat_W_r0o1E3P83EfnVCjEk0/exec";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  date: string;
}

/** Simple markdown-like renderer */
function renderContent(raw: string) {
  return raw.split("\n\n").map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Heading
    if (trimmed.startsWith("## ")) {
      return <h2 key={i} className={styles.contentH2}>{trimmed.replace("## ", "")}</h2>;
    }
    if (trimmed.startsWith("### ")) {
      return <h3 key={i} className={styles.contentH3}>{trimmed.replace("### ", "")}</h3>;
    }

    // Bullet list
    if (trimmed.startsWith("- ")) {
      const items = trimmed.split("\n").filter(l => l.trim().startsWith("- "));
      return (
        <ul key={i} className={styles.contentList}>
          {items.map((item, j) => (
            <li key={j}>{item.replace(/^-\s*/, "")}</li>
          ))}
        </ul>
      );
    }

    // Paragraph — handle **bold**
    const html = trimmed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <p key={i} className={styles.contentP} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export default function PostContent() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${APPS_SCRIPT_URL}?action=blog&store=PNY01`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data.posts || []).find((p: BlogPost) => p.slug === slug);
        setPost(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

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
            <p>This blog post doesn&apos;t exist or has been removed.</p>
            <Link href="/blog" className={styles.backLink}>← Back to Blog</Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

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

        <header className={styles.header}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            <span>{post.author}</span>
            <span>·</span>
            <span>
              {new Date(post.date).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </header>

        <div className={styles.body}>
          {renderContent(post.content)}
        </div>

        <div className={styles.cta}>
          <p>
            <strong>P60 Cannabis</strong> — 1938 Weston Rd, York · Open Daily: 10:00 AM - 03:00 AM · (437) 522-2802
          </p>
          <Link href="/exotic" className={styles.ctaBtn}>Browse Our Menu</Link>
        </div>

        <Link href="/blog" className={styles.backLink}>← Back to Blog</Link>
      </article>
      <Footer />
    </main>
  );
}
