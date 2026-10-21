"use client";

import { SHOW_CIGARETTES } from "../lib/siteConfig";


import { useEffect, useRef, useState } from "react";

export const CIGARETTE_SEASONAL_TEXT =
  "Cigarettes are seasonal and in limited stock. Please check in store for availability.";

const wrapStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  margin: 0,
  padding: "10px 12px",
  display: "flex",
  justifyContent: "center",
  background: "transparent",
};

// Sticky strip is opaque (page background) so products never show around/through the pill.
const stickyStripBg = "var(--bg-primary, #ffffff)";

const pillStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  maxWidth: "1100px",
  boxSizing: "border-box" as const,
  margin: 0,
  padding: "12px 22px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #7a4a1f 0%, #a0672e 100%)",
  border: "1.5px solid #e8c27a",
  boxShadow: "0 6px 18px rgba(0,0,0,.35)",
  color: "#fff8ea",
  textAlign: "center" as const,
  fontWeight: 800,
  fontSize: "clamp(14px, 2.1vw, 18px)",
  lineHeight: 1.35,
  textTransform: "none" as const,
  letterSpacing: "normal",
  textShadow: "0 1px 2px rgba(0,0,0,.35)",
  overflowWrap: "anywhere" as const,
};

/** Brown seasonal-stock notice. `sticky` pins it just under the site nav on scroll. */
export default function CigaretteSeasonalNotice({ sticky = false }: { sticky?: boolean }) {
  if (!SHOW_CIGARETTES) return null;
  const ref = useRef<HTMLDivElement>(null);
  const [navBottom, setNavBottom] = useState(0);
  const [clearance, setClearance] = useState(0);

  useEffect(() => {
    if (!sticky) return;
    const nav = document.querySelector<HTMLElement>("#main-nav, header[data-site-header], header.site-header, header, nav.nav");
    const node = ref.current;
    if (!nav || !node) return;
    const update = () => {
      const pos = window.getComputedStyle(nav).position;
      const pinned = pos === "sticky" || pos === "fixed";
      const cs = window.getComputedStyle(nav);
      // Sticky nav: use its pinned position (sticky top + height), not where it happens to be right now.
      const bottom = !pinned ? 0 : pos === "sticky" ? Math.floor((Number.parseFloat(cs.top) || 0) + nav.getBoundingClientRect().height) : Math.floor(nav.getBoundingClientRect().bottom);
      setNavBottom(bottom);
      // A fixed nav sits on top of page flow: push the notice below it (measured at top of page only).
      if (pos === "fixed" && window.scrollY < 2) {
        const margin = Number.parseFloat(window.getComputedStyle(node).marginTop) || 0;
        const flowTop = node.getBoundingClientRect().top - margin;
        setClearance(Math.max(0, bottom - flowTop));
      }
    };
    update();
    const late = window.setTimeout(update, 400);
    window.addEventListener("load", update);
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.clearTimeout(late);
      window.removeEventListener("load", update);
      window.removeEventListener("resize", update);
    };
  }, [sticky]);

  return (
    <div
      ref={ref}
      data-cigarette-seasonal-wrap={sticky ? "sticky" : "inline"}
      style={sticky ? { ...wrapStyle, background: stickyStripBg, position: "sticky", top: navBottom, marginTop: clearance, zIndex: 900, isolation: "isolate" } : wrapStyle}
    >
      <p
        role="note"
        data-cigarette-seasonal-notice={sticky ? "sticky" : "inline"}
        style={pillStyle}
      >
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px", maxWidth: "100%", margin: "0 auto" }}>
          <svg aria-hidden="true" focusable="false" width="26" height="14" viewBox="0 0 26 14" style={{ flex: "0 0 auto", display: "block" }}>
            <rect x="1" y="6" width="17" height="6" rx="1" fill="#fff8ea" />
            <rect x="18" y="6" width="6" height="6" rx="1" fill="#e8a24a" />
            <rect x="1" y="6" width="2.5" height="6" rx="0.5" fill="#ff7a3d" />
            <path d="M5 4.5c0-1.5 1.6-1.5 1.6-3M8.5 4.5c0-1.5 1.6-1.5 1.6-3" stroke="#fff8ea" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity=".75" />
          </svg>
          <span style={{ textAlign: "center" }}>{CIGARETTE_SEASONAL_TEXT}</span>
        </span>
      </p>
    </div>
  );
}
