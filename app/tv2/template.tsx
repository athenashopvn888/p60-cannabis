import type { ReactNode } from "react";
import MenuUpdatingBadge from "../components/MenuUpdatingBadge";

// Grok 2026-10-08: small "Menu updating" notice on the in-store board, shown only when
// /api/tv-data reports stock older than 48 h. New file; the TV layout and promo files are untouched.
export default function TvMenuFreshnessTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MenuUpdatingBadge />
    </>
  );
}
