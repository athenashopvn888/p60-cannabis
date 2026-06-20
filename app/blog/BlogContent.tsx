"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./blog.module.css";

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

/* ── Static Blog Posts (always shown) ── */
const STATIC_POSTS = [
  {
    slug: "indica-vs-sativa-vs-hybrid",
    title: "Indica vs Sativa vs Hybrid — What's the Difference?",
    excerpt: "Not sure which type to pick? We break down the effects, best uses, and top strains for each category so you can shop with confidence.",
    date: "2026-05-10",
    category: "Guides",
    emoji: "🌿",
    readTime: "5 min",
  },
  {
    slug: "how-to-choose-thc-level",
    title: "How to Choose the Right THC Level for You",
    excerpt: "From 24% budget strains to 39% exotic fire — here's how to pick the THC percentage that matches your tolerance and desired experience.",
    date: "2026-05-08",
    category: "Guides",
    emoji: "🔬",
    readTime: "4 min",
  },
  {
    slug: "edibles-dosing-guide",
    title: "Edibles Dosing Guide — Start Low, Go Slow",
    excerpt: "First time trying edibles? Our dosing chart covers everything from 5mg micro-doses to 100mg+ for experienced users.",
    date: "2026-05-05",
    category: "Guides",
    emoji: "🍬",
    readTime: "6 min",
  },
  {
    slug: "best-dispensary-byward-market",
    title: "Why P60 Cannabis is York's Best Dispensary",
    excerpt: "200+ strains, transparent pricing from $3/g, lab-tested products, and convenient hours. Here's what makes us different.",
    date: "2026-05-03",
    category: "News",
    emoji: "🔥",
    readTime: "3 min",
  },
  {
    slug: "vape-pen-vs-flower",
    title: "Vape Pen vs Flower — Which Should You Choose?",
    excerpt: "Convenience vs tradition. We compare effects, cost, discretion, and flavor to help you decide between vaping and smoking.",
    date: "2026-04-28",
    category: "Guides",
    emoji: "💨",
    readTime: "5 min",
  },
  {
    slug: "brampton-cannabis-laws-2026",
    title: "York Cannabis Laws in 2026 — What You Need to Know",
    excerpt: "Age limits, public consumption rules, possession limits, and where you can legally smoke in York. Stay informed.",
    date: "2026-04-25",
    category: "News",
    emoji: "⚖️",
    readTime: "4 min",
  },
];

/* ── Google Reviews ── */
const REVIEWS = [
  { name: "Mike R.", rating: 5, text: "Best dispensary in the York area. Staff is super knowledgeable and the exotic strains are legit fire.", date: "2 weeks ago" },
  { name: "Sarah L.", rating: 5, text: "Love their convenient opening hours. The selection is insane — over 200 strains. My go-to spot.", date: "1 month ago" },
  { name: "James T.", rating: 5, text: "Tried the Buy 2g Get 1g Free deal on the AAA+ and it was incredible value.", date: "3 weeks ago" },
  { name: "Priya K.", rating: 5, text: "Clean store, friendly staff, great edible selection. The gummies are perfectly dosed.", date: "1 week ago" },
  { name: "Alex D.", rating: 5, text: "Finally a dispensary that lists everything with actual THC percentages and per-gram pricing.", date: "2 weeks ago" },
];

function truncate(text: string, len: number) {
  if (text.length <= len) return text;
  return text.substring(0, len).replace(/\s+\S*$/, "") + "...";
}

export default function BlogContent() {
  const [dynamicPosts, setDynamicPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`${APPS_SCRIPT_URL}?action=blog&store=PNY01`)
      .then((r) => r.json())
      .then((data) => setDynamicPosts(data.posts || []))
      .catch(() => {});
  }, []);

  return (
    <main className={styles.main}>
      <Navbar />

      {/* Blog Banner */}
      <section style={{ width: "100%", overflow: "hidden", marginTop: "92px" }}>
        <img
          src="/banners/blog_banner.webp"
          alt="P60 Cannabis Blog"
          style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }}
        />
      </section>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroH1}>
            📝 P60 Cannabis <span className={styles.heroAccent}>Blog</span>
          </h1>
          <p className={styles.heroSub}>
            Cannabis guides, strain reviews, and dispensary news from York&apos;s
            premium dispensary.
          </p>
        </div>
      </section>

      {/* Dynamic Blog Posts from CMS */}
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
                  <div className={styles.postEmoji}>📰</div>
                  <div className={styles.postMeta}>
                    <span className={styles.postCategory}>Blog</span>
                    <span className={styles.postDot}>·</span>
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

      {/* Reviews Section */}
      <section className={styles.reviewsSection}>
        <div className={styles.container}>
          <div className={styles.reviewsHeader}>
            <h2 className={styles.reviewsTitle}>⭐ What Our Customers Say</h2>
            <div className={styles.reviewsRating}>
              <span className={styles.reviewsStars}>★★★★★</span>
              <span className={styles.reviewsScore}>5.0</span>
              <span className={styles.reviewsCount}>on Google</span>
            </div>
          </div>
          <div className={styles.reviewsGrid}>
            {REVIEWS.map((r, i) => (
              <div key={i} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div className={styles.reviewAvatar}>{r.name.charAt(0)}</div>
                  <div>
                    <div className={styles.reviewName}>{r.name}</div>
                    <div className={styles.reviewDate}>{r.date}</div>
                  </div>
                  <div className={styles.reviewStars}>
                    {"★".repeat(r.rating)}
                  </div>
                </div>
                <p className={styles.reviewText}>{r.text}</p>
              </div>
            ))}
          </div>
          <div className={styles.reviewsCta}>
          </div>
        </div>
      </section>

      {/* Static Blog Posts */}
      <section className={styles.postsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Guides &amp; Resources</h2>
          <div className={styles.postsGrid}>
            {STATIC_POSTS.map((post) => (
              <article key={post.slug} className={styles.postCard}>
                <div className={styles.postEmoji}>{post.emoji}</div>
                <div className={styles.postMeta}>
                  <span className={styles.postCategory}>{post.category}</span>
                  <span className={styles.postDot}>·</span>
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
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Ready to Shop?</h2>
          <p className={styles.ctaSub}>
            200+ strains · Exotic to Budget · Open Daily: 10:00 AM - 03:00 AM
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
