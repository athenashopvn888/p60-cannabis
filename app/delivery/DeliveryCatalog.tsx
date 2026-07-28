"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import menu from "./delivery-menu.json";

type Option = { key: string; label: string; price: number; regularPrice?: number };
type PrimeOffer = { kind: "prime_time"; title: string; price: number; weight: string; bonus: string; label: string };
type MultiOunceOffer = { kind: "multi_ounce"; quantity: number; unitWeight: "28g"; perUnitPrice?: number; totalPrice: number; label: string };
type Product = { sourceProductId: number; sku: string; name: string; category: string; thc: string; priceOptions: Option[]; offers: (PrimeOffer | MultiOunceOffer)[]; image: string | null };
type Tier = "SHREDS" | "Budget" | "BC Premium" | "CRAFTS" | "Exotics";
type TierFilter = "ALL" | Tier;
const products = menu.products as Product[];
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
  const [activeTier, setActiveTier] = useState<TierFilter>("ALL");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => products.filter((product) => {
    if (activeTier !== "ALL" && tier(product) !== activeTier) return false;
    const needle = search.trim().toLowerCase();
    return !needle || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(needle);
  }).sort(compareProducts), [activeTier, search]);
  return (
    <div className="pny-original-shell">
      <header className="store-header pny-store-header">
        <div className="header-main"><a className="brand-lockup" href="#top"><span className="brand-mark">P60</span><span><strong>P60 Cannabis</strong><small>York delivery menu</small></span></a><nav className="desktop-nav"><a href="#menu">Menu</a><a href="#delivery-steps">How to order</a></nav><div className="header-actions"><a className="pny-search-jump" href="#menu">Search</a></div></div>
        <div className="category-strip pny-category-strip" aria-label="Flower tier filters">{tierFilters.map((item) => <button type="button" key={item} className={activeTier === item ? "active" : ""} onClick={() => setActiveTier(item)}>{item === "ALL" ? "ALL" : item.toUpperCase()}</button>)}</div>
      </header>

      <section className="pny-neon-terms" aria-labelledby="pny-terms"><div><p>P60 DELIVERY DETAILS</p><h2 id="pny-terms"><span>$60 PRODUCT MINIMUM</span><span>$10 DELIVERY FEE</span></h2></div><a href="#delivery-steps">Read the ordering steps</a></section>

      <main className="delivery-page" id="top">
        <section className="store-hero pny-cinematic-hero"><Image src="/pny-original/p60-delivery-banner.jpg" alt="P60 Cannabis York delivery menu" fill priority sizes="100vw" /><div className="store-hero-copy"><p>P60 Cannabis Delivery</p><h1>York delivery menu.</h1><span>Browse the current flower selection, then use Web Chat to contact the dispatcher.</span></div></section>

        <section className="service-strip pny-eight-tile-strip" aria-label="P60 delivery menu features">{features.map(([image, label]) => <article key={label}><Image src={`/pny-original/${image}`} alt="" width={180} height={180} /><strong>{label}</strong></article>)}</section>

        <section className="menu-layout pny-two-column-layout" id="menu">
          <section className="menu-main pny-menu-main"><div className="menu-tools"><div><p className="eyebrow">P60 FLOWER MENU</p><h2>{activeTier === "ALL" ? "Flowers" : activeTier}</h2></div><label className="menu-search"><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, SKU, strain" /></label></div><p className="result-summary">{filtered.length} flower products.</p>
            <div className="product-grid pny-tile-grid">{filtered.map((product) => {
              const productTier = tier(product);
              return <article className="product-card pny-vertical-card" key={product.sourceProductId}><div className="product-image-button">{product.image ? <Image src={product.image} alt={`${product.name} on the P60 delivery menu`} fill sizes="(max-width:640px) 50vw, 240px" /> : <span>No image</span>}</div><div className="product-body"><div className="product-badges">{productTier && <span className="badge">{productTier}</span>}<span className="badge secondary">{strain(product)}</span></div><h2 className="product-title">{product.name}</h2><p className="product-meta">SKU {product.sku} | {product.category}{product.thc ? ` | ${product.thc} THC` : ""}</p><strong className="all-weight-label">Available weights</strong><div className="price-matrix card-matrix">{product.priceOptions.map((option) => <div key={option.key} className="matrix-pill"><span>{option.label}</span>{option.regularPrice && <del>${option.regularPrice}</del>}<strong>${option.price}</strong></div>)}</div>{product.offers.length > 0 && <div className="product-offers">{product.offers.map((offer, index) => offer.kind === "prime_time" ? <div className="prime-offer" key={`${offer.kind}-${index}`}><strong>{offer.title}</strong><span>{offer.label}</span></div> : <div className="bundle-offer" key={`${offer.kind}-${offer.quantity}`}><strong>Bundle special</strong><span>{offer.label}</span></div>)}</div>}</div></article>;
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
