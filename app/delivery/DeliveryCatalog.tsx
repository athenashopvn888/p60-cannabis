"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import menu from "./delivery-menu.json";

type Option = { key: string; label: string; price: number; regularPrice?: number };
type MemberOffer = { kind: "prime_time"; title: string; price: number; weight: string; bonus: string; label: string };
type MultiOunceOffer = { kind: "multi_ounce"; quantity: number; unitWeight: "28g"; perUnitPrice?: number; totalPrice: number; label: string };
type Product = { sourceProductId: number; sku: string; name: string; category: string; thc: string; priceOptions: Option[]; offers: (MemberOffer | MultiOunceOffer)[]; image: string | null };
type Tier = "SHREDS" | "Budget" | "BC Premium" | "CRAFTS" | "Exotics";
type TierFilter = "ALL" | Tier;
const bundledProducts = menu.products as Product[];
const tierFilters: TierFilter[] = ["ALL", "Exotics", "CRAFTS", "BC Premium", "Budget", "SHREDS"];
const tierDisplayOrder: Tier[] = ["Exotics", "CRAFTS", "BC Premium", "Budget", "SHREDS"];
const features = [
  ["fast-delivery.webp", "Delivery Menu"], ["order-online.webp", "Choose Weights"],
  ["live-tracking.webp", "Text To Order"], ["discreet-packaging.webp", "Photo ID"],
  ["open-late.webp", "Cash Only"], ["safe-secure.webp", "Dispatch Confirm"],
  ["location.webp", "Driver ETA"], ["premium-products.webp", "Vehicle Meet"],
];

function strain(product: Product) {
  const value = product.category.toUpperCase();
  if (value.includes("INDICA") && !value.includes("HYBRID")) return "INDICA";
  if (value.includes("SATIVA") && !value.includes("HYBRID")) return "SATIVA";
  return "HYBRID";
}

function parseTierSku(rawSku: string) {
  if (/^[1-9]\d*$/.test(rawSku)) return Number(rawSku);
  const variant = rawSku.match(/^([1-9]\d{2})-\d+$/);
  return variant ? Number(variant[1]) : null;
}

function tier(product: Product): Tier | null {
  const sku = parseTierSku(product.sku);
  if (sku === null) return null;
  if (sku >= 100 && sku <= 199 && /\bSHREDS\b/i.test(product.name)) return "SHREDS";
  if (sku >= 100 && sku <= 299) return "Budget";
  if (sku >= 300 && sku <= 399) return "BC Premium";
  if (sku >= 400 && sku <= 499) return "CRAFTS";
  if (sku >= 500 && sku <= 599) return "Exotics";
  return null;
}

function normalEntryPrice(product: Product) {
  const prices = product.priceOptions.map((option) => option.price);
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
}

function compareProducts(a: Product, b: Product) {
  const tierA = tier(a);
  const tierB = tier(b);
  const tierDifference = (tierA ? tierDisplayOrder.indexOf(tierA) : tierDisplayOrder.length) - (tierB ? tierDisplayOrder.indexOf(tierB) : tierDisplayOrder.length);
  if (tierDifference !== 0) return tierDifference;
  const priceA = normalEntryPrice(a);
  const priceB = normalEntryPrice(b);
  if (priceA !== priceB) return priceA - priceB;
  const skuDifference = (parseTierSku(a.sku) ?? Number.MAX_SAFE_INTEGER) - (parseTierSku(b.sku) ?? Number.MAX_SAFE_INTEGER);
  return skuDifference || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>(bundledProducts);
  const [activeTier, setActiveTier] = useState<TierFilter>("ALL");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("https://milestone-1-demo.vercel.app/api/catalog?store=P60", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => { if (Array.isArray(payload.products) && payload.products.length >= 50) setProducts(payload.products); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => products.filter((product) => {
    if (activeTier !== "ALL" && tier(product) !== activeTier) return false;
    const needle = search.trim().toLowerCase();
    return !needle || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(needle);
  }).sort(compareProducts), [activeTier, search, products]);
  return (
    <div className="pny-original-shell">
      <header className="store-header pny-store-header">
        <div className="header-main"><a className="brand-lockup" href="#top"><span className="brand-mark">P60</span><span><strong>P60 Cannabis</strong><small>York delivery menu</small></span></a><nav className="desktop-nav"><a href="#menu">Menu</a><a href="#delivery-steps">How to order</a></nav><div className="header-actions"><a className="pny-search-jump" href="#menu">Search</a></div></div>
        <div className="category-strip pny-category-strip" aria-label="Flower tier filters">{tierFilters.map((item) => <button type="button" key={item} className={activeTier === item ? "active" : ""} onClick={() => setActiveTier(item)}>{item === "ALL" ? "ALL" : item.toUpperCase()}</button>)}</div>
      </header>

      <section className="pny-neon-terms" aria-labelledby="pny-terms"><div><p>P60 DELIVERY DETAILS</p><h2 id="pny-terms"><span>$60 PRODUCT MINIMUM</span><span>$10 DELIVERY FEE</span></h2></div><a href="#delivery-steps">Read the ordering steps</a></section>

      <main className="delivery-page" id="top">
        <section className="store-hero pny-cinematic-hero"><Image src="/p60-delivery-menu-banner.webp" alt="P60 Cannabis delivery banner" width={1774} height={887} priority sizes="(max-width: 1500px) 100vw, 1444px" /></section>

        <section className="member-loyalty" aria-labelledby="member-loyalty-title">
          <div className="member-loyalty-heading">
            <p className="eyebrow">SAVE ON A LATER ORDER</p>
            <h2 id="member-loyalty-title">Member Loyalty Savings</h2>
            <p>Qualify with an eligible regular-price 28g purchase in BC Premium, Crafts, or Exotics, or with a selected 2 × 28g tier offer. Rewards and coupons apply to a later order—not the qualifying purchase.</p>
          </div>
          <ol className="member-loyalty-steps">
            <li><span>1</span><div><strong>Qualify</strong><p>Purchase an eligible regular-price ounce or selected two-ounce tier offer.</p></div></li>
            <li><span>2</span><div><strong>Return</strong><p>On your next visit, receive $30 off an eligible regular-price 28g item in the selected tier.</p></div></li>
            <li><span>3</span><div><strong>Use your coupon later</strong><p>A 3g Craft coupon requires a qualifying spend of $120 or more and is redeemed on your next order.</p></div></li>
            <li><span>4</span><div><strong>Keep access active</strong><p>Make a purchase of $50 or more within 14 days, or requalify with a full-price purchase.</p></div></li>
          </ol>
          <div className="member-loyalty-conditions">
            <strong>Important conditions</strong>
            <p>Complimentary items apply only to regular-price Craft or Exotic ounces—not BC Premium. Loyalty prices are firm and cannot be reduced with points. Loyalty-price orders do not include extra complimentary items. Dispatcher confirms current eligibility and any included item before checkout.</p>
          </div>
        </section>

        <section className="service-strip pny-eight-tile-strip" aria-label="P60 delivery menu features">{features.map(([image, label]) => <article key={label}><Image src={`/pny-original/${image}`} alt="" width={180} height={180} /><strong>{label}</strong></article>)}</section>

        <section className="menu-layout pny-two-column-layout" id="menu">
          <section className="menu-main pny-menu-main"><div className="menu-tools"><div><p className="eyebrow">P60 FLOWER MENU</p><h2>{activeTier === "ALL" ? "Flowers" : activeTier}</h2></div><label className="menu-search"><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, SKU, strain" /></label></div><p className="result-summary">{filtered.length} flower products.</p>
            <div className="product-grid pny-tile-grid">{filtered.map((product) => {
              const productTier = tier(product);
              return <article className="product-card pny-vertical-card" key={product.sourceProductId}><div className="product-image-button">{product.image ? <Image src={product.image} alt={`${product.name} on the P60 delivery menu`} fill sizes="(max-width:640px) 50vw, 240px" /> : <span>No image</span>}</div><div className="product-body"><div className="product-badges">{productTier && <span className="badge">{productTier}</span>}<span className="badge secondary">{strain(product)}</span></div><h2 className="product-title">{product.name}</h2><p className="product-meta">SKU {product.sku} | {product.category}{product.thc ? ` | ${product.thc} THC` : ""}</p><strong className="all-weight-label">Standard prices</strong><div className="price-matrix card-matrix">{product.priceOptions.map((option) => <div key={option.key} className="matrix-pill"><span>{option.label}</span>{option.regularPrice && <del>${option.regularPrice}</del>}<strong>${option.price}</strong></div>)}</div>{product.offers.length > 0 && <div className="product-offers">{product.offers.map((offer, index) => offer.kind === "prime_time" ? <div className="member-offer" key={`${offer.kind}-${index}`}><strong>Member Loyalty</strong><span>${offer.price} / {offer.weight} · {offer.bonus} for your next order</span></div> : <div className="bundle-offer" key={`${offer.kind}-${offer.quantity}`}><strong>Multi-ounce total</strong><span>{offer.label}</span></div>)}</div>}</div></article>;
            })}</div>
          </section>
        </section>
        <section className="pny-delivery-steps" id="delivery-steps" aria-labelledby="delivery-steps-title">
          <p className="eyebrow">HOW TO ORDER</p>
          <h2 id="delivery-steps-title">Web Chat connects you with the P60 dispatcher.</h2>
          <ol><li>Browse the menu and note the product names and weights.</li><li>Open Web Chat and send the dispatcher your choices.</li><li>New customers complete private selfie-with-ID verification in Web Chat.</li><li>The dispatcher confirms availability, delivery details, and next steps.</li></ol>
        </section>
      </main>
    </div>
  );
}
