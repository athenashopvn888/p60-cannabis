"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import Navbar from "./components/Navbar";
import HiringCallout from "./components/HiringCallout";
import Footer from "./components/Footer";
import FlowerCard from "./components/FlowerCard";
import { allFlowers } from "./lib/products";

/* ── Bento Mosaic Config ── */
const BENTO_TIERS = [
  {
    name: "EXOTICS",
    slug: "exotic",
    price: "$10-$12/g",
    banner: "/banners/p60-real/tile-exotic.webp",
    className: styles.bentoExotic,
  },
  {
    name: "PREMIUM",
    slug: "premium",
    price: "$7-$10/g",
    banner: "/banners/p60-real/tile-premium.webp",
    className: styles.bentoPremium,
  },
  {
    name: "AAA+",
    slug: "aaa",
    price: "$5-$6/g",
    banner: "/banners/p60-real/tile-aaa.webp",
    className: styles.bentoTile,
  },
  {
    name: "AA",
    slug: "aa",
    price: "$4/g",
    banner: "/banners/p60-real/tile-aa.webp",
    className: styles.bentoTile,
  },
  {
    name: "BUDGET",
    slug: "budget",
    price: "$3/g",
    banner: "/banners/p60-real/tile-budget.webp",
    className: styles.bentoTile,
  },
  {
    name: "EDIBLES + MORE",
    slug: "items/edibles",
    price: "Shop menu",
    banner: "/banners/p60-real/tile-menu-plus.webp",
    className: styles.bentoEdibles,
  },
];

/* ── Explore Categories Config (New Banners) ── */
const EXPLORE_CATEGORIES = [
  { name: "Vape Pens", slug: "items/vapes", banner: "/banners/p60-real/tile-thc-vape.webp", icon: "💨" },
  { name: "Nic Vape", slug: "items/vape-disposables", banner: "/banners/p60-real/tile-nic-vape.webp", icon: "💨" },
  { name: "Concentrates", slug: "items/concentrates", banner: "/banners/p60-real/tile-concentrates.webp", icon: "💎" },
  { name: "Pre-Rolls", slug: "items/prerolls", banner: "/banners/p60-real/tile-prerolls.webp", icon: "🚬" },
  { name: "Accessories", slug: "items/add-ons", banner: "/banners/p60-real/tile-accessories.webp", icon: "➕" },
  { name: "Cigarettes", slug: "items/cigarettes", banner: "/banners/p60-real/tile-cigarettes.webp", icon: "🏷️" },
  { name: "Magic Stuff", slug: "items/magic", banner: "/banners/p60-real/tile-magic.webp", icon: "🍄" },
];

/* ── Local FAQs for Jane St ── */
const LOCAL_FAQS = [
  {
    q: "What are the hours for P60 Cannabis?",
    a: "P60 Cannabis at 1938 Weston Rd, York is open daily from 10:00 AM to 03:00 AM. Walk in anytime — no appointment needed.",
  },
  {
    q: "What cannabis products do you carry?",
    a: "We carry five tiers of premium flower: Exotic ($10-$12/g), Premium ($7-$10/g), AAA+ ($5-$6/g), AA ($4/g), and Budget ($3/g), plus a wide variety of edibles, prerolls, vapes, and concentrates.",
  },
  {
    q: "Where is P60 Cannabis located?",
    a: "We are located at 1938 Weston Rd, York, ON M9N 1W2. Visit us in person or call us at (437) 522-2802. Free evening street parking is available.",
  },
  {
    q: "What is the cheapest weed at P60 Cannabis?",
    a: "Our budget flower starts at just $3/g. We also offer AA daily drivers from $4/g and AAA+ heavy hitters from $5-$6/g. View our budget menu for our latest deals.",
  },
];

interface Review {
  name: string;
  comment: string;
  date: string;
}

interface ReviewStats {
  total: number;
  avg: number;
}

export default function HomePage() {
  const [featuredStrains, setFeaturedStrains] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsStats, setReviewsStats] = useState<ReviewStats | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [welcomeBannerError, setWelcomeBannerError] = useState(false);
  const welcomeBannerSrc: string = "/banners/homepage_hero.webp";
  const hasWelcomeBanner = welcomeBannerSrc && welcomeBannerSrc !== "/banners/" && !welcomeBannerSrc.includes("HERO_BANNER") && !welcomeBannerSrc.includes("WELCOME_BANNER") && welcomeBannerSrc !== "";

  /* ── 1. Fetch Client-Side Google Reviews ── */
  useEffect(() => {
    const STORE_KEY = "PNY01";
    const SHEET_ID = "1-KeuyKFKprbU-Vl_qVQiZkEKMX_i5CmdScTToNTdkUY";
    const SHEET_NAME = "WEBSITE_REVIEWS";
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

    fetch(url)
      .then((r) => r.text())
      .then((raw) => {
        const jsonStart = raw.indexOf("{");
        const jsonEnd = raw.lastIndexOf("}");
        const jsonString = raw.substring(jsonStart, jsonEnd + 1);
        const json = JSON.parse(jsonString);
        const rows = json.table.rows;
        const cols = json.table.cols;

        const colMap: Record<string, number> = {};
        cols.forEach((col: any, idx: number) => {
          if (col.label) colMap[col.label.trim()] = idx;
        });

        const skIdx = colMap["StoreKey"] !== undefined ? colMap["StoreKey"] : 0;
        const rnIdx = colMap["ReviewerName"] !== undefined ? colMap["ReviewerName"] : 1;
        const cmIdx = colMap["Comment"] !== undefined ? colMap["Comment"] : 2;
        const dtIdx = colMap["CreateTime"] !== undefined ? colMap["CreateTime"] : 3;

        const reviewsPool: Review[] = [];
        let totalVal: number | null = null;
        let avgVal: number | null = null;
        let hasStats = false;

        rows.forEach((row: any) => {
          if (!row.c) return;
          const sk = row.c[skIdx] ? row.c[skIdx].v || "" : "";
          if (sk !== STORE_KEY) return;

          const rn = row.c[rnIdx] ? row.c[rnIdx].v || "" : "";
          if (rn === "__STATS__") {
            const parsedTotal = parseInt(row.c[cmIdx] ? row.c[cmIdx].v : "", 10);
            const parsedAvg = parseFloat(row.c[dtIdx] ? row.c[dtIdx].v : "");
            if (Number.isFinite(parsedTotal) && Number.isFinite(parsedAvg)) {
              totalVal = parsedTotal;
              avgVal = parsedAvg;
              hasStats = true;
            }
            return;
          }

          const comment = row.c[cmIdx] ? row.c[cmIdx].v || "" : "";
          if (!comment || comment.length < 10) return;
          const name = rn || "Customer";
          const dateStr = row.c[dtIdx] ? row.c[dtIdx].v || "" : "";
          reviewsPool.push({ name, comment, date: dateStr });
        });

        setReviews(reviewsPool.slice(0, 6));
        if (hasStats && totalVal !== null && avgVal !== null) {
          setReviewsStats({ total: totalVal, avg: avgVal });
        }
        setReviewsLoading(false);
      })
      .catch((err) => {
        console.warn("Reviews fetch failed:", err);
        setReviewsLoading(false);
      });
  }, []);

  /* ── 2. Build Featured Strains ── */
  useEffect(() => {
    const pool = [...allFlowers].filter((f) => f.image);
    // Shuffle pool securely
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const picked: typeof pool = [];
    const tierCounts: Record<string, number> = {};

    for (const f of pool) {
      if (picked.length >= 8) break;
      const tc = tierCounts[f.tier] || 0;
      if (tc >= 2) continue; // max 2 per tier
      if (picked.some((p) => p.name === f.name)) continue; // avoid exact duplicates
      picked.push(f);
      tierCounts[f.tier] = tc + 1;
    }

    setFeaturedStrains(picked);
  }, []);

  return (
    <main className={styles.main}>
      {/* ── NAVBAR ── */}
      <Navbar />
      <HiringCallout />

      {/* ── BENTO MOSAIC HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroStars} />

        <div className={styles.heroContent}>
          <div className={styles.deliveryHeroShell}>
            <div className={styles.deliveryHeroCopy}>
              <div className={styles.brandBlock}>
                <img src="/storeFavicon.webp" alt="P60 Cannabis Icon" className={styles.brandLogo} />
                <span className={styles.deliveryKicker}>Weston Rd / York</span>
                <h1 className={styles.brandTitle}>P60 CANNABIS</h1>
                <p className={styles.brandSub}>Premium Cannabis Dispensary</p>
                <div className={styles.brandBadge}>Open Daily: 10:00 AM - 03:00 AM</div>
              </div>

              <div className={styles.deliveryFacts}>
                <span>1938 Weston Rd</span>
                <span>Fast pickup flow</span>
                <span>Adults 19+</span>
              </div>

              <div className={styles.heroActions}>
                <Link href="/delivery" className={styles.heroPrimary}>Delivery Info</Link>
                <Link href="#menu" className={styles.heroSecondary}>Browse Menu</Link>
              </div>
            </div>

            {hasWelcomeBanner && !welcomeBannerError && (
              <div className={styles.deliveryHeroMedia}>
                <img
                  src={welcomeBannerSrc}
                  alt="P60 Cannabis delivery banner"
                  className={styles.deliveryHeroImg}
                  onError={() => setWelcomeBannerError(true)}
                />
              </div>
            )}
          </div>

          <div className={styles.deliveryPromiseGrid}>
            <div><strong>Fast Delivery</strong><span>Store-branded delivery presentation</span></div>
            <div><strong>Open Late</strong><span>10:00 AM - 03:00 AM</span></div>
            <div><strong>Weston Rd</strong><span>York, ON M9N 1W2</span></div>
            <div><strong>Menu First</strong><span>Flower tiers and core categories</span></div>
          </div>

          <div className={styles.bentoHeader}>
            <span>Flower Tiers</span>
            <p>Choose by tier, then browse the current menu.</p>
          </div>

          <div className={styles.bentoGrid}>
            {BENTO_TIERS.map((tier) => (
              <Link
                key={tier.slug}
                href={`/${tier.slug}`}
                className={`${styles.bentoTile} ${tier.className}`}
              >
                <div
                  className={styles.bentoTileBg}
                  style={{ backgroundImage: `url('${tier.banner}')` }}
                />
                <div className={styles.bentoTileOverlay} />
                <div className={styles.bentoTileContent}>
                  <span className={styles.bentoLabel}>{tier.name}</span>
                  <span className={styles.bentoPrice}>{tier.price}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXPLORE CATEGORIES ── */}
      <section className={styles.categoriesSection} id="menu">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Explore Categories</h2>
            <p className={styles.sectionSubtitle}>
              From custom disposable vapes and concentrates to accessories and cigarettes.
            </p>
          </div>

          <div className={styles.categoriesGrid}>
            {EXPLORE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/${cat.slug}`}
                className={styles.categoryCard}
              >
                <div
                  className={styles.categoryCardBg}
                  style={{ backgroundImage: `url('${cat.banner}')` }}
                />
                <div className={styles.categoryCardOverlay} />
                <div className={styles.categoryCardContent}>
                  <h3 className={styles.categoryCardName}>
                    {cat.icon} {cat.name} <span className={styles.categoryCardArrow}>→</span>
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section className={styles.featuredSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Featured Strains</h2>
            <p className={styles.sectionSubtitle}>
              Staff picks and top sellers dynamically updated from our real-time stock sheet.
            </p>
          </div>

          <div className={styles.featuredScroll}>
            {featuredStrains.map((strain, i) => (
              <div key={`${strain.sku}-${i}`} className={styles.scrollItem}>
                <FlowerCard flower={strain} tierKey={strain.tier} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO PANEL WRITE-UP ── */}
      <section className={styles.seoSection}>
        <div className={styles.container}>
          <div className={styles.seoPanel}>
            <h2 className={styles.seoPanelTitle}>P60 Cannabis On Weston Rd In York - Open Daily: 10:00 AM - 03:00 AM</h2>
            <p className={styles.seoPanelText}>
              Welcome to <strong>P60 Cannabis</strong> at 1938 Weston Rd in York. Use the current menu to compare flower tiers, pre-rolls, edibles, vapes, concentrates, cigarettes, and accessories before visiting.
            </p>
            <p className={styles.seoPanelText}>
              We are open Open Daily: 10:00 AM - 03:00 AM — P60 Cannabis is here to serve you. Our live menu is constantly refreshed with the freshest drops, premium prerolls, artisan edibles, and everything in between. Whether you're winding down or stocking up for the weekend, our knowledgeable staff can help during listed store hours.
            </p>
            <p className={styles.seoPanelText}>
              Searching for a cannabis dispensary in York or the surrounding area? P60 Cannabis is your go-to destination for premium flower, potent prerolls, and artisan edibles. Our six-tier pricing system means quality cannabis at every budget level — starting from just $3/g.
            </p>
          </div>
        </div>
      </section>

      {/* ── CLIENT-SIDE GOOGLE REVIEWS SHOWCASE ── */}
      <section className={styles.reviewsSection}>
        <div className={styles.container}>
          <div className={styles.reviewsHeader}>
            <h2 className={styles.sectionTitle}>What Our Customers Say</h2>
            {reviewsStats && (
              <div className={styles.reviewsStarsSummary}>
                <span className={styles.reviewsStars}>★★★★★</span>
                <span className={styles.reviewsAvg}>
                  {reviewsStats.avg.toFixed(1)}
                </span>
                <span className={styles.reviewsCount}>
                  ({reviewsStats.total} Google reviews)
                </span>
              </div>
            )}
          </div>

          <div className={styles.reviewsGrid}>
            {reviewsLoading ? (
              <div className={styles.reviewsLoading}>Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className={styles.reviewsLoading}>
                Reviews are not available right now.
              </div>
            ) : (
              reviews.map((rv, idx) => (
                <div key={idx} className={styles.rvCard}>
                  <div className={styles.rvTop}>
                    <div className={styles.rvAvatar}>
                      {rv.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.rvMeta}>
                      <span className={styles.rvName}>{rv.name}</span>
                      {rv.date && (
                        <span className={styles.rvDate}>
                          {new Date(rv.date).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    <span className={styles.rvStars}>★★★★★</span>
                  </div>
                  <p className={styles.rvText}>
                    {rv.comment.length > 180 ? `${rv.comment.substring(0, 177)}...` : rv.comment}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className={styles.reviewCtaRow}>
          </div>
        </div>
      </section>

      {/* ── FAQS SECTION ── */}
      <section className={styles.faqSection}>
        <div className={styles.faqContainer}>
          <h2 className={styles.sectionTitle} style={{ textAlign: "center", marginBottom: "32px" }}>
            Frequently Asked Questions
          </h2>
          {LOCAL_FAQS.map((faq, i) => (
            <details key={i} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{faq.q}</summary>
              <p className={styles.faqAnswer}>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── STORE LOCATION GRID ── */}
      <section className={styles.storeSection} id="contact">
        <div className={styles.container}>
          <div className={styles.storeGrid}>
            <div className={styles.storeCard}>
              <span className={styles.storeIcon}>📍</span>
              <h3 className={styles.storeCardTitle}>Location</h3>
              <p className={styles.storeCardText}>
                1938 Weston Rd
                <br />
                York, ON M9N 1W2
                <br />
              </p>
            </div>
            <div className={styles.storeCard}>
              <span className={styles.storeIcon}>🕒</span>
              <h3 className={styles.storeCardTitle}>Hours</h3>
              <p className={styles.storeCardText}>
                Open 7 Days a Week
                <br />
                <span className={styles.storeHighlight}>Open Daily: 10:00 AM - 03:00 AM</span>
              </p>
            </div>
            <div className={styles.storeCard}>
              <span className={styles.storeIcon}>🔥</span>
              <h3 className={styles.storeCardTitle}>Walk In</h3>
              <p className={styles.storeCardText}>
                No appointment needed
                <br />
                <span className={styles.storeHighlight}>1938 Weston Rd, York</span>
              </p>
            </div>
          </div>

          {/* Map wrapper */}
          <div className={styles.mapWrap}>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer />
    </main>
  );
}
