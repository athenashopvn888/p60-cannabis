"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORE_NAME = "P60 Cannabis";
const STORE_AREA = "Weston Road, York";
const STORE_ORIGIN = "https://www.p60cannabis.com";
const TOP_WEED_IMAGE = "/banners/core-top-weed-tier.webp";
const CIGARETTE_IMAGE = "/banners/native-cigarette-offer-20260822.webp";
const VAPE_IMAGE = "/banners/core-vapes-nicotine-thc.webp";
const PREMIUM_CIGARETTE_IMAGE = "/banners/core-premium-bb-marlboro-belmont.webp";

const imageObjects = [
  { name: `${STORE_NAME} top weed tiers`, description: `Exotic, Premium and AAA+ weed tiers at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${TOP_WEED_IMAGE}` },
  { name: `${STORE_NAME} nicotine and THC vapes`, description: `Nicotine vapes and THC vapes at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${VAPE_IMAGE}` },
  { name: `${STORE_NAME} cigarette mix and match`, description: `Two packs for $5 mix and match and $25 carton cigarette offer at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${CIGARETTE_IMAGE}` },
  { name: `${STORE_NAME} premium cigarette offer`, description: `BB Full Flavor and Lights two packs for $5 plus Marlboro and Belmont for $10 per pack at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${PREMIUM_CIGARETTE_IMAGE}` },
].map((image) => ({ "@type": "ImageObject", ...image, caption: image.description }));

function isHalloweenNoticeActive(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const dateKey = Number(`${value.year}${value.month}${value.day}`);
  return dateKey >= 20261014 && dateKey <= 20261031;
}

const figureStyle = { margin: 0, width: "100%" } as const;
const imageStyle = { display: "block", width: "100%", maxWidth: "100%", height: "auto" } as const;
const linkStyle = { display: "block", width: "100%" } as const;
const captionStyle = { margin: 0, padding: "14px 18px", background: "#111827", color: "#ffffff", textAlign: "center" as const, fontSize: "clamp(17px, 1.7vw, 28px)", fontWeight: 800, lineHeight: 1.35 };
const captionLinkStyle = { color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" } as const;

export default function FleetAnnouncementBanner() {
  const [showHalloweenNotice, setShowHalloweenNotice] = useState(false);
  useEffect(() => {
    const updateVisibility = () => setShowHalloweenNotice(isHalloweenNoticeActive(new Date()));
    updateVisibility();
    const timer = window.setInterval(updateVisibility, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside data-fleet-homepage-announcement="" aria-label="Store announcements" style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "100%", overflowX: "hidden", position: "relative", zIndex: 50 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": imageObjects }).replace(/</g, "\\u003c") }} />

      <figure data-core-banner="weed" data-exotic-tier-banner="" style={figureStyle}>
        <Link href="/exotic-weed" aria-label={`Shop Exotic, Premium and AAA+ weed tiers at ${STORE_NAME}`} style={linkStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TOP_WEED_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — Exotic, Premium and AAA+ top weed tiers`} title={`${STORE_NAME} top weed tiers — Exotic, Premium and AAA+`} style={imageStyle} />
        </Link>
        <figcaption style={captionStyle}>Exotic, Premium and AAA+ weed · <Link href="/exotic-weed" style={captionLinkStyle}>Shop weed tiers</Link><span data-free-gram-strip="" style={{ display: "block", marginTop: "6px", color: "#facc15" }}>Top 3 tiers only (Exotic, Premium, AAA+): Buy 2g Get 1g FREE · Buy 3g Get 3g FREE (6g)</span></figcaption>
      </figure>

      <figure data-core-banner="vapes" data-vape-banner="" style={figureStyle}>
        <Link href="/items/vapes" aria-label={`Shop nicotine vapes and THC vapes at ${STORE_NAME}`} style={linkStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={VAPE_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — nicotine vapes and THC vapes`} title={`${STORE_NAME} nicotine vapes and THC vapes`} style={imageStyle} loading="lazy" />
        </Link>
        <figcaption style={captionStyle}>Nicotine vapes + THC vapes · <Link href="/items/vapes" style={captionLinkStyle}>Shop vapes</Link></figcaption>
      </figure>

      <figure data-core-banner="cigarettes" data-cig-mix-banner="" style={figureStyle}>
        <Link href="/items/cigarettes" aria-label={`Shop cigarette mix and match offers at ${STORE_NAME}`} style={linkStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CIGARETTE_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — 2 packs for $5 mix and match and $25 carton cigarette offer`} title={`${STORE_NAME} cigarette offer — 2 packs $5 mix and match, $25 carton`} style={imageStyle} loading="lazy" />
        </Link>
        <figcaption style={captionStyle}>2 packs $5 mix &amp; match · $25 carton · <Link href="/items/cigarettes" style={captionLinkStyle}>Shop cigarettes</Link></figcaption>
      </figure>

      <figure data-core-banner="premium-cigarettes" data-premium-cigarette-banner="" style={figureStyle}>
        <Link href="/items/cigarettes" aria-label={`Shop BB, Marlboro and Belmont cigarette offers at ${STORE_NAME}`} style={linkStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PREMIUM_CIGARETTE_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — BB Full Flavor and Lights 2 packs for $5, Marlboro and Belmont $10 per pack`} title={`${STORE_NAME} premium cigarettes — BB 2 packs $5, Marlboro and Belmont $10 per pack`} style={imageStyle} loading="lazy" />
        </Link>
        <figcaption style={captionStyle}>BB Full Flavor + Lights — 2 packs $5 · Marlboro &amp; Belmont — $10/pack · <Link href="/items/cigarettes" style={captionLinkStyle}>Shop cigarettes</Link></figcaption>
      </figure>
      {showHalloweenNotice ? <p data-halloween-hours-notice="">Happy Halloween! {STORE_NAME} is open regular hours on Saturday, October 31.</p> : null}
    </aside>
  );
}
