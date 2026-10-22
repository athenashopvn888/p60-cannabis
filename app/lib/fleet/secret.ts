import { timingSafeEqual } from "node:crypto";
import { FLEET_REVALIDATE_ENV } from "./read.ts";

/** Compare the request header with the env secret. Never log either value. */
export function revalidateAuthorized(provided: string | null, expected = process.env[FLEET_REVALIDATE_ENV]): boolean {
  if (!expected || provided == null) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
