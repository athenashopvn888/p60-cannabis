import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNED_MEDIA_MAX_AGE_SECONDS = 10 * 60;
export const SIGNED_MEDIA_DEFAULT_AGE_SECONDS = 5 * 60;
export const STAFF_MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function signStaffMedia(id: string, exp: number | string, secret: string) {
  return createHmac("sha256", secret).update(`${id}.${exp}`).digest("hex");
}

export function createSignedStaffMediaUrl({
  origin,
  id,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = SIGNED_MEDIA_DEFAULT_AGE_SECONDS,
}: {
  origin: string;
  id: string;
  secret: string;
  nowSeconds?: number;
  maxAgeSeconds?: number;
}) {
  if (!STAFF_MEDIA_ID_PATTERN.test(id)) throw new Error("Invalid media id.");
  if (!secret || secret.length < 32) throw new Error("Collector authorization is not configured.");
  if (
    !Number.isInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1 ||
    maxAgeSeconds > SIGNED_MEDIA_MAX_AGE_SECONDS
  ) {
    throw new Error("Invalid signed media lifetime.");
  }
  const expiresAt = nowSeconds + maxAgeSeconds;
  const signature = signStaffMedia(id, expiresAt, secret);
  const url = new URL(`/api/staff-photo/collector/public-media/${id}`, origin);
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return { url: url.toString(), expiresAt };
}

export function verifyStaffMediaSignature({
  id,
  exp,
  signature,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  id: string;
  exp: string;
  signature: string;
  secret: string | undefined;
  nowSeconds?: number;
}) {
  if (!STAFF_MEDIA_ID_PATTERN.test(id)) return false;
  if (!/^\d+$/.test(exp)) return false;
  const expiresAt = Number(exp);
  if (!Number.isSafeInteger(expiresAt) || String(expiresAt) !== exp) return false;
  if (expiresAt <= nowSeconds || expiresAt > nowSeconds + SIGNED_MEDIA_MAX_AGE_SECONDS) return false;
  if (!secret || secret.length < 32 || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = signStaffMedia(id, exp, secret);
  const suppliedBytes = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
