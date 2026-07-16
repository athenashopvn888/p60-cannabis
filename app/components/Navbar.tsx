"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./Navbar.module.css";

const ALL_LINKS = [
  { href: "/careers/budtender", label: "Join Team" },
  { href: "/exotic", label: "Exotic" },
  { href: "/premium", label: "Premium" },
  { href: "/aaa", label: "AAA+" },
  { href: "/aa", label: "AA" },
  { href: "/budget", label: "Budget" },
  { href: "/items/edibles", label: "Edibles" },
  { href: "/items/prerolls", label: "Pre-Rolls" },
  { href: "/items/vapes", label: "Nic Vape" },
  { href: "/items/vape-disposables", label: "THC Vape" },
  { href: "/items/concentrates", label: "Concentrates" },
  { href: "/items/magic", label: "Magic Stuff" },
  { href: "/items/cigarettes", label: "Cigarettes" },
  { href: "/items/add-ons", label: "Accessories" },
  { href: "/delivery", label: "🚗 Delivery" },
  { href: "/faq", label: "FAQ" },
  { href: "/resources", label: "Resources" },
];

export default function Navbar() {
  const pathname = usePathname();
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const [canAdvance, setCanAdvance] = useState(false);

  const updateScrollState = useCallback(() => {
    const scrollBar = scrollBarRef.current;
    if (!scrollBar) return;

    setCanAdvance(scrollBar.scrollWidth - scrollBar.clientWidth - scrollBar.scrollLeft > 2);
  }, []);

  useEffect(() => {
    const scrollBar = scrollBarRef.current;
    if (!scrollBar) return;

    updateScrollState();
    scrollBar.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollBar);
    if (scrollBar.firstElementChild) resizeObserver.observe(scrollBar.firstElementChild);

    return () => {
      scrollBar.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [pathname, updateScrollState]);

  const advanceScrollBar = () => {
    const scrollBar = scrollBarRef.current;
    if (!scrollBar) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollBar.scrollBy({
      left: Math.max(180, scrollBar.clientWidth * 0.75),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <nav className={styles.navbar} id="main-nav">
      {/* Top bar — logo + open now */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.logo} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <img src="/storeFavicon.webp" alt="P60 Cannabis Logo" style={{ height: "30px", width: "30px", objectFit: "contain", borderRadius: "4px" }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "18px",
            letterSpacing: "0.04em",
            color: "white",
            textShadow: "0 0 12px rgba(255,255,255,0.2)"
          }}>
            P60 CANNABIS
          </span>
        </Link>
        <div className={styles.topBarRight}>
          <span className={styles.open}>
            <span className={styles.dot}></span>
            Open Now
          </span>
        </div>
      </div>

      {/* Scrollable link bar */}
      <div className={styles.scrollShell}>
        <div ref={scrollBarRef} id="p60-menu-scrollbar" className={styles.scrollBar}>
          <div className={styles.scrollInner}>
          {ALL_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.pill} ${isActive ? styles.pillActive : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
          </div>
        </div>
        {canAdvance && (
          <button
            type="button"
            className={styles.scrollAdvance}
            aria-label="Show more navigation links"
            aria-controls="p60-menu-scrollbar"
            onClick={advanceScrollBar}
          >
            <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
    </nav>
  );
}
