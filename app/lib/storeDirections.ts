import { FULL_NAME_NAP, FULL_NAME_NAP_ADDRESS } from "./fullNameNap.ts";
import { gbpLocation } from "./gbp-location.ts";

/**
 * Prefer a maps.app.goo.gl (or goo.gl/maps) pin, then any other GBP place
 * link already in config. Only when those are missing, build a Google Maps
 * directions URL to the store address.
 */
export function pickStoreDirectionsUrl(links: readonly string[], address: string): string {
  const usable = links.map((link) => link.trim()).filter(Boolean);
  const short = usable.find((href) => /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(href));
  if (short) return short;
  const pin = usable.find((href) => /(?:place_id:|\/maps\/place\b)/i.test(href));
  if (pin) return pin;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** NAP place-id pin first. gbpLocation.directionsUrl is empty for this store. */
export const STORE_DIRECTIONS_URL = pickStoreDirectionsUrl(
  [FULL_NAME_NAP.mapsUrl, gbpLocation.directionsUrl],
  FULL_NAME_NAP_ADDRESS,
);
