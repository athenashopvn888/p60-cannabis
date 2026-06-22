"use client";

import { useState } from "react";
import Link from "next/link";
import type { FlowerProduct, PricePoint } from "../lib/products";
import { TIER_CONFIG } from "../lib/products";
import styles from "./FlowerCard.module.css";

interface WeightOption {
  key: string;
  label: string;
  grams: number;
  price: PricePoint | null;
  promo?: string;
}

function getTypeLabel(t: string) {
  if (t === "indica") return "Indica";
  if (t === "sativa") return "Sativa";
  return "Hybrid";
}

function getTypeClass(t: string) {
  if (t === "indica") return styles.badgeIndica;
  if (t === "sativa") return styles.badgeSativa;
  return styles.badgeHybrid;
}

export default function FlowerCard({
  flower,
  tierKey,
}: {
  flower: FlowerProduct;
  tierKey: string;
}) {
  const tierCfg = TIER_CONFIG[tierKey];
  const isPromoTier = !!tierCfg?.deal6g; // Exotic, Premium, AAA+

  const weights: WeightOption[] = [];
  if (flower.price3g) {
    weights.push({
      key: "3g",
      label: "3g",
      grams: 3,
      price: flower.price3g,
      promo: isPromoTier ? "3g bundle" : tierCfg?.deal3g?.label,
    });
  }
  if (flower.price5g) {
    const grams = isPromoTier ? 6 : 5;
    weights.push({
      key: "5g",
      label: `${grams}g`,
      grams,
      price: flower.price5g,
      promo: isPromoTier ? "6g bundle" : undefined,
    });
  }
  if (flower.price14g) {
    weights.push({ key: "14g", label: "14g", grams: 14, price: flower.price14g });
  }
  if (flower.price28g) {
    weights.push({ key: "28g", label: "28g", grams: 28, price: flower.price28g });
  }

  const [selected, setSelected] = useState(0);
  const active = weights[selected] || weights[0];

  if (!active) return null;

  const effectivePrice = active.price
    ? (active.price.sale ?? active.price.regular)
    : 0;
  const perGram =
    effectivePrice > 0 ? (effectivePrice / active.grams).toFixed(2) : "—";

  return (
    <div className={styles.card}>
      {/* Image */}
      <Link href={`/flower/${flower.slug}`} className={styles.imageLink}>
        <div className={styles.imageWrap}>
          <img
            src={flower.image}
            alt={flower.name}
            loading="lazy"
            className={styles.img}
          
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />
          {/* THC badge */}
          <span className={styles.thcBadge}>THC {flower.thc}</span>

          {/* Sale tag */}
          {flower.isSale && (
            <span className={styles.saleTag}>SALE</span>
          )}
        </div>
      </Link>

      {/* Body */}
      <div className={styles.body}>
        {/* Type badge */}
        <span className={`${styles.typeBadge} ${getTypeClass(flower.type)}`}>
          {getTypeLabel(flower.type)}
        </span>

        {/* Name */}
        <h3 className={styles.name}>{flower.name}</h3>

        {/* Price + $/g */}
        <div className={styles.priceRow}>
          {active.price && active.price.sale !== null ? (
            <div className={styles.priceGroup}>
              <span className={styles.priceMain}>${active.price.sale}</span>
              <span className={styles.priceOld}>${active.price.regular}</span>
            </div>
          ) : (
            <span className={styles.priceMain}>${active.price?.regular}</span>
          )}
          <div className={styles.perGramWrap}>
            {isPromoTier && tierCfg?.unitPrice ? (
              <>
                <span className={styles.perGramOld}>${tierCfg.unitPrice}/g</span>
                <span className={styles.perGram}>${perGram}/g</span>
              </>
            ) : (
              <span className={styles.perGram}>${perGram}/g</span>
            )}
          </div>
        </div>

        {/* Promo line */}
        {active.promo && (
          <div className={styles.promoLine}>
            🎁 {active.promo}
          </div>
        )}

        {/* Weight pills — CLICKABLE */}
        <div className={styles.weightPills}>
          {weights.map((w, i) => (
            <button
              key={w.key}
              type="button"
              className={`${styles.pill} ${i === selected ? styles.pillActive : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelected(i);
              }}
            >
              <span className={styles.pillLabel}>{w.label}</span>
              <span className={styles.pillPrice}>
                ${w.price ? (w.price.sale ?? w.price.regular) : "—"}
              </span>
            </button>
          ))}
        </div>

        {/* View Details CTA */}
        <Link href={`/flower/${flower.slug}`} className={styles.viewBtn}>
          View Details →
        </Link>
      </div>
    </div>
  );
}
