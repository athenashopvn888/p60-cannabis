"use client";
import CigaretteSeasonalNotice from "../CigaretteSeasonalNotice";

import Link from "next/link";
import HomeTitleBlock from "../HomeTitleBlock";
import { useEffect, useRef, useState } from "react";
import { useCigaretteState } from "../CigaretteStateProvider";
import { FLEET_AREA, FLEET_COLORS, FLEET_ORIGIN, FLEET_STORE_NAME } from "../../lib/fleet/config";
import type { ResolvedBanner } from "../../lib/fleet/types";

const STORE_NAME = FLEET_STORE_NAME;
const STORE_AREA = FLEET_AREA;
const STORE_ORIGIN = FLEET_ORIGIN;
const TOP_WEED_IMAGE = "/banners/core-top-weed-tier.webp";
const CIGARETTE_IMAGE = "/banners/native-cigarette-offer-20260822.webp";
const VAPE_IMAGE = "/banners/core-vapes-nicotine-thc.webp";
const PREMIUM_CIGARETTE_IMAGE = "/banners/core-premium-bb-marlboro-belmont.webp";

const imageObjects = [
  { name: `${STORE_NAME} top weed tiers`, description: `Exotic, Premium and AAA+ weed tiers at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${TOP_WEED_IMAGE}` },
  { name: `${STORE_NAME} nicotine and THC vapes`, description: `Nicotine vapes and THC vapes at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${VAPE_IMAGE}` },
  { name: `${STORE_NAME} cigarette mix and match`, description: `Two packs for $5 mix and match and $25 carton cigarette offer at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${CIGARETTE_IMAGE}` },
  { name: `${STORE_NAME} premium cigarette offer`, description: `BB Full Flavor and Lights plus Marlboro and Belmont cigarette offer at ${STORE_NAME} in ${STORE_AREA}.`, contentUrl: `${STORE_ORIGIN}${PREMIUM_CIGARETTE_IMAGE}` },
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
const captionStyle = { margin: 0, padding: "10px 14px", background: FLEET_COLORS.banner, color: FLEET_COLORS.bannerText, textAlign: "center" as const, fontWeight: 800, lineHeight: 1.35 };

function BannerFigure({ banner }: { banner: ResolvedBanner }) {
  const [src, setSrc] = useState(banner.image);
  const [imageFailed, setImageFailed] = useState(false);
  const showText = banner.render === "text" || imageFailed || !src;
  // Name stays useCodedFallback so the image-fallback test can find onError={useCodedFallback}.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- this is a handler, not a Hook
  const useCodedFallback = () => {
    if (banner.codedImage && src !== banner.codedImage) {
      setSrc(banner.codedImage);
      return;
    }
    setImageFailed(true);
  };
  return (
    <figure data-core-banner={banner.id} style={figureStyle}>
      {showText ? (
        <div data-fleet-text-banner="" style={{ ...imageStyle, minHeight: banner.imageHeight || 180, display: "flex", alignItems: "center", justifyContent: "center", background: FLEET_COLORS.banner, color: FLEET_COLORS.bannerText, fontWeight: 800, fontSize: "clamp(28px, 4vw, 48px)" }}>{banner.categoryName}</div>
      ) : (
        <Link href={banner.href} style={linkStyle}>
          {/* useCodedFallback is an image handler, not a Hook. */}
          {/* eslint-disable-next-line @next/next/no-img-element, react-hooks/rules-of-hooks */}
          <img key={src} src={src} alt={banner.alt} title={banner.title} width={banner.imageWidth} height={banner.imageHeight} style={imageStyle} ref={(node) => { if (node?.complete && node.naturalWidth === 0) useCodedFallback(); }} onError={useCodedFallback} />
        </Link>
      )}
      <figcaption style={captionStyle}>{banner.textBar}</figcaption>
    </figure>
  );
}

export default function FleetAnnouncementBanner({ title, banners }: { title?: string; banners?: ResolvedBanner[] } = {}) {
  const cigarettes = useCigaretteState();
  const showCigarettes = cigarettes.web;
  const announcementRef = useRef<HTMLElement>(null);
  const [navClearance, setNavClearance] = useState<number | null>(null);
  const [showHalloweenNotice, setShowHalloweenNotice] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setShowHalloweenNotice(isHalloweenNoticeActive(new Date()));
    updateVisibility();
    const timer = window.setInterval(updateVisibility, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const announcement = announcementRef.current;
    const nav = document.getElementById("main-nav");
    if (!announcement || !nav) return;
    let frame = 0;
    const updateClearance = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Document coordinates (scroll-safe); only a fixed nav overlaps page flow.
        const currentMargin = Number.parseFloat(window.getComputedStyle(announcement).marginTop) || 0;
        const flowTopDoc = announcement.getBoundingClientRect().top + window.scrollY - currentMargin;
        const nextClearance = window.getComputedStyle(nav).position === "fixed" ? Math.min(400, Math.max(0, Math.ceil(nav.getBoundingClientRect().bottom - flowTopDoc))) : 0;
        setNavClearance((current) => current === nextClearance ? current : nextClearance);
      });
    };
    updateClearance();
    const resizeObserver = new ResizeObserver(updateClearance);
    resizeObserver.observe(nav);
    window.addEventListener("resize", updateClearance);
    return () => { window.cancelAnimationFrame(frame); resizeObserver.disconnect(); window.removeEventListener("resize", updateClearance); };
  }, []);

  return (
    <aside ref={announcementRef} data-fleet-homepage-announcement="" data-nav-clearance-self="" aria-label="Store announcements" style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "100%", height: "auto", overflowX: "hidden", overflowY: "visible", marginTop: navClearance === null ? undefined : navClearance, position: "relative", zIndex: 50 }}>
      {title ? <HomeTitleBlock title={title} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": showCigarettes ? imageObjects : imageObjects.filter((image) => !/cigarette/i.test(image.name)) }).replace(/</g, "\\u003c") }} />
      {banners ? <>{showCigarettes ? <CigaretteSeasonalNotice /> : null}{banners.filter((banner) => !banner.hidden && (showCigarettes || (banner.id !== "cigarettes" && banner.id !== "premium-cigarettes"))).map((banner) => <BannerFigure key={banner.id} banner={banner} />)}</> : (
        <>
      <figure data-core-banner="weed" data-exotic-tier-banner="" style={figureStyle}><Link href="/exotic-weed" aria-label={`Shop Exotic, Premium and AAA+ weed tiers at ${STORE_NAME}`} style={linkStyle}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={TOP_WEED_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — Exotic, Premium and AAA+ top weed tiers`} title={`${STORE_NAME} top weed tiers — Exotic, Premium and AAA+`} style={imageStyle} /></Link><figcaption style={captionStyle}>Top 3 tiers only (Exotic, Premium, AAA+): Buy 2g Get 1g FREE · Buy 3g Get 3g FREE (6g)</figcaption></figure>
      <figure data-core-banner="vapes" data-vape-banner="" style={figureStyle}><Link href="/items/vapes" aria-label={`Shop nicotine vapes and THC vapes at ${STORE_NAME}`} style={linkStyle}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={VAPE_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — nicotine vapes and THC vapes`} title={`${STORE_NAME} nicotine vapes and THC vapes`} style={imageStyle} loading="lazy" /></Link><figcaption style={captionStyle}>Nicotine + THC vapes</figcaption></figure>
      {showCigarettes ? <CigaretteSeasonalNotice /> : null}
      {showCigarettes ? <figure data-core-banner="cigarettes" data-cig-mix-banner="" style={figureStyle}><Link href="/items/cigarettes" aria-label={`Shop cigarette mix and match offers at ${STORE_NAME}`} style={linkStyle}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={CIGARETTE_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — 2 packs for $5 mix and match and $25 carton cigarette offer`} title={`${STORE_NAME} cigarette offer — 2 packs $5 mix and match, $25 carton`} style={imageStyle} loading="lazy" /></Link><figcaption style={captionStyle}>{cigarettes.wording.bannerText}</figcaption></figure> : null}
      {showCigarettes ? <figure data-core-banner="premium-cigarettes" data-premium-cigarette-banner="" style={figureStyle}><Link href="/items/cigarettes" aria-label={`Shop BB, Marlboro and Belmont cigarette offers at ${STORE_NAME}`} style={linkStyle}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={PREMIUM_CIGARETTE_IMAGE} alt={`${STORE_NAME} in ${STORE_AREA} — BB Full Flavor and Lights, Marlboro and Belmont premium cigarettes`} title={`${STORE_NAME} premium cigarettes — BB, Marlboro and Belmont`} style={imageStyle} loading="lazy" /></Link><figcaption style={captionStyle}>{cigarettes.wording.promoBrands}</figcaption></figure> : null}
        </>
      )}
      {showHalloweenNotice ? <p data-halloween-hours-notice="">Happy Halloween! {STORE_NAME} is open regular hours on Saturday, October 31.</p> : null}
    </aside>
  );
}
