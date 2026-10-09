import type { ReactNode } from "react";
import MenuUpdatingBadge from "../../components/MenuUpdatingBadge";

// Grok 2026-10-08: shows a small "Menu updating" notice on the web menu only when
// /api/tv-data reports stock older than 48 h (same signal as /tv and /tv2). No other change.
export default function MenuFreshnessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MenuUpdatingBadge />
    </>
  );
}
