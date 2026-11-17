import { PNY02_STORE } from "../lib/pny-pos/storeProfile.ts";

export type PosRoute = {
  apiBase: string;
  label: string;
  tillHref: string;
  homeHref: string;
  menuUrl: string;
};

/** /pos2 must never fall back to the PNY01 till, even if the page props are missing. */
export function pos2Route(pathname: string): PosRoute | null {
  if (pathname !== "/pos2" && !pathname.startsWith("/pos2/")) return null;
  return {
    apiBase: PNY02_STORE.apiBase,
    label: PNY02_STORE.label,
    tillHref: PNY02_STORE.tillPath,
    homeHref: PNY02_STORE.posPath,
    menuUrl: PNY02_STORE.menuUrl,
  };
}

export function pos2RouteFromLocation(): PosRoute | null {
  if (typeof window === "undefined") return null;
  return pos2Route(window.location.pathname);
}
