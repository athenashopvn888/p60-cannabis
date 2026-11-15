import { PNY01_STORE, PNY02_STORE, type StoreProfile } from "./storeProfile.ts";

/** Set only on a one-store Vercel project. Unset on p60cannabis.com, which keeps both tills. */
export function lockedStore(): StoreProfile | null {
  const code = process.env.STORE_CODE?.trim().toUpperCase();
  if (code === "PNY02" || code === "PNY2") return PNY02_STORE;
  if (code === "PNY01" || code === "PNY1") return PNY01_STORE;
  return null;
}

export function singleStoreSite() {
  return lockedStore() != null;
}
