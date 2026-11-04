import { createHash, timingSafeEqual } from "node:crypto";

/** Header for the read-only SCCx sales feed. Not the shift secret. */
export const SALES_FEED_HEADER = "x-sales-feed-token";

/** True only when the header matches SALES_FEED_TOKEN. An empty token never matches. */
export function salesFeedTokenOk(header: string | null) {
  const expected = process.env["SALES_FEED_TOKEN"]?.trim() ?? "";
  const got = header?.trim() ?? "";
  if (!expected || !got) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(got).digest();
  return timingSafeEqual(a, b);
}
