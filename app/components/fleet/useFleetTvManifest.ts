"use client";

import { useEffect, useState } from "react";
import type { TvCardSlot, TvFullscreenPromo } from "../../lib/fleet/types";

export type FleetTvClientState = {
  cards: Record<string, TvCardSlot>;
  fullscreenPromos: TvFullscreenPromo[];
};

const EMPTY: FleetTvClientState = { cards: {}, fullscreenPromos: [] };

function sameState(left: FleetTvClientState, right: FleetTvClientState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function parseFleetTvManifest(body: unknown): FleetTvClientState {
  if (!body || typeof body !== "object") return EMPTY;
  const record = body as { tvCards?: unknown; fullscreenPromos?: unknown };
  const cards: Record<string, TvCardSlot> = {};
  if (record.tvCards && typeof record.tvCards === "object" && !Array.isArray(record.tvCards)) {
    for (const [card, value] of Object.entries(record.tvCards as Record<string, TvCardSlot>)) {
      if (!value || typeof value !== "object") continue;
      cards[card] = {
        card,
        promoImage: typeof value.promoImage === "string" ? value.promoImage : null,
        promoAlt: typeof value.promoAlt === "string" ? value.promoAlt : card,
        offImage: typeof value.offImage === "string" ? value.offImage : null,
        offAlt: typeof value.offAlt === "string" ? value.offAlt : card,
      };
    }
  }
  const fullscreenPromos = Array.isArray(record.fullscreenPromos)
    ? record.fullscreenPromos.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const promo = item as TvFullscreenPromo;
        if (typeof promo.image !== "string" || !promo.image) return [];
        return [{
          spot: String(promo.spot || ""),
          image: promo.image,
          alt: typeof promo.alt === "string" ? promo.alt : "",
          showSeconds: Number(promo.showSeconds) > 0 ? Number(promo.showSeconds) : 5,
          everyMinutes: Number(promo.everyMinutes) > 0 ? Number(promo.everyMinutes) : 1,
        }];
      })
    : [];
  return { cards, fullscreenPromos };
}

export function useFleetTvManifest(): FleetTvClientState {
  const [state, setState] = useState<FleetTvClientState>(EMPTY);

  useEffect(() => {
    let etag = "";
    let stop = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/tv-manifest", {
          headers: etag ? { "if-none-match": etag } : {},
          cache: "no-store",
        });
        const next = response.headers.get("etag");
        if (next) etag = next;
        if (response.status === 304 || !response.ok) return;
        const body = await response.json();
        if (stop) return;
        const parsed = parseFleetTvManifest(body);
        setState((current) => (sameState(current, parsed) ? current : parsed));
      } catch {
        /* keep the last board; a missed poll is not a content change */
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
