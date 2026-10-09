"use client";

import { useEffect, useState } from "react";

/**
 * Small "Menu updating" notice for the in-store boards (Grok 2026-10-08).
 * Shows only when /api/tv-data reports x-tv-data-stale: 1 (stock older than 48 h,
 * or a bundled snapshot of unknown age). Hidden otherwise. Checks every 10 minutes.
 */
export default function MenuUpdatingBadge() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/tv-data?type=items", { cache: "no-store" });
        if (alive) setStale(res.headers.get("x-tv-data-stale") === "1");
      } catch {
        /* keep last state */
      }
    };
    check();
    const id = setInterval(check, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!stale) return null;
  return (
    <div
      role="status"
      data-menu-updating
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 2147483000,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        font: "600 14px/1.2 system-ui, sans-serif",
        letterSpacing: 0.3,
        pointerEvents: "none",
      }}
    >
      Menu updating
    </div>
  );
}
