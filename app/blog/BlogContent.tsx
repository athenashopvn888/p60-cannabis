"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./blog.module.css";
import { STATIC_POSTS } from "./staticPosts";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySrZYxI-NNnXfxY1jXOqHgT2HQi4zst2Fgte6FXTeymat_W_r0o1E3P83EfnVCjEk0/exec";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  date: string;
  published: string;
}

function truncate(text: string, len: number) {
  if (text.length <= len) return text;
  return text.substring(0, len).replace(/\s+\S*$/, "") + "...";
}

export default function BlogContent() {
  const [dynamicPosts, setDynamicPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`${APPS_SCRIPT_URL}?action=blog&store=PNY01`)
      .then((r) => r.json())
      .then((data) => setDynamicPosts(Array.isArray(data.posts) ? data.posts : []))
      .catch(() => {});
  }, []);

  return (
    <main className={styles.main}>
      <Navbar />

      <section style={{ width: "100%", overflow: "hidden", marginTop: "92px" }}>
        <img
          src="/banners/blog_banner.webp"
          alt="P60 Cannabis Blog"
          style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }}
        />
      </section>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroH1}>
            P60 Cannabis <span className={styles.heroAccent}>Blog</span>
          </h1>
          <p className={styles.heroSub}>
            Useful store notes for adults 19+. No template fluff, no mystery claims,
            just the stuff worth checking before you head over.
          </p>
        </div>
      </section>

      {dynamicPosts.length > 0 && (
        <section className={styles.postsSection}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Latest Posts</h2>
            <div className={styles.postsGrid}>
              {dynamicPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className={styles.postCard}
                >
                  <div className={styles.postEmoji}>New</div>
                  <div className={styles.postMeta}>
                    <span className={styles.postCategory}>Blog</span>
                    <span className={styles.postDot}>.</span>
                    <span className={styles.postTime}>{post.author}</span>
                  </div>
                  <h3 className={styles.postTitle}>{post.title}</h3>
                  <p className={styles.postExcerpt}>
                    {truncate(post.content.replace(/[#*\-]/g, ""), 160)}
                  </p>
                  <div className={styles.postDate}>
                    {new Date(post.date).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.postsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Guides That Actually Help</h2>
          <div className={styles.postsGrid}>
            {STATIC_POSTS.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.postCard}>
                <div className={styles.postEmoji}>Read</div>
                <div className={styles.postMeta}>
                  <span className={styles.postCategory}>{post.category}</span>
                  <span className={styles.postDot}>.</span>
                  <span className={styles.postTime}>{post.readTime}</span>
                </div>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.postExcerpt}>{post.excerpt}</p>
                <div className={styles.postDate}>
                  {new Date(post.date).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Ready to Shop?</h2>
          <p className={styles.ctaSub}>
            Check the current menu before heading to 1938 Weston Rd.
          </p>
          <div className={styles.ctaBtns}>
            <Link href="/exotic" className={styles.ctaBtn}>
              Browse Menu
            </Link>
            <Link href="/faq" className={styles.ctaBtnSecondary}>
              FAQ
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
