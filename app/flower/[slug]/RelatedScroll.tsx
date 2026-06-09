"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import styles from "./flower.module.css";

interface RelatedFlower {
  sku: string;
  slug: string;
  name: string;
  image: string;
  thc: string;
}

export default function RelatedScroll({
  flowers,
  tierName,
  tierColor,
}: {
  flowers: RelatedFlower[];
  tierName: string;
  tierColor: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el?.removeEventListener("scroll", checkScroll);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  if (!flowers.length) return null;

  return (
    <section className={styles.related}>
      <h2 className={styles.relatedTitle}>
        More <span style={{ color: tierColor }}>{tierName}</span> Strains
      </h2>
      <div className={styles.relatedWrap}>
        {canScrollLeft && (
          <button
            className={`${styles.scrollBtn} ${styles.scrollBtnLeft}`}
            onClick={() => scroll("left")}
            aria-label="Scroll left"
          >
            &#8249;
          </button>
        )}

        <div className={styles.relatedScroll} ref={scrollRef}>
          {flowers.map((r) => (
            <Link
              key={r.sku + r.slug}
              href={`/flower/${r.slug}`}
              className={styles.relatedCard}
            >
              <div className={styles.relatedImg}>
                {r.image ? (
                  <img src={r.image} alt={r.name} loading="lazy" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />
                ) : (
                  <span>{r.name[0]}</span>
                )}
              </div>
              <div className={styles.relatedBody}>
                <h3>{r.name}</h3>
                <span className={styles.relatedThc}>THC {r.thc}</span>
              </div>
            </Link>
          ))}
        </div>

        {canScrollRight && (
          <button
            className={`${styles.scrollBtn} ${styles.scrollBtnRight}`}
            onClick={() => scroll("right")}
            aria-label="Scroll right"
          >
            &#8250;
          </button>
        )}
      </div>
    </section>
  );
}
