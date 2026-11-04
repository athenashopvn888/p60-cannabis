import { createHmac } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { safeEqual } from "./crypto.ts";

export type DemoCount = {
  sku: string;
  counted_qty: number;
  expected_qty?: number;
  submitted_at?: string;
  added_stock?: boolean;
  accepted_as_is?: boolean;
  variance_reason?: string | null;
};

export type DemoDraft = {
  shift_id: string;
  counts: { sku: string; counted_qty: number }[];
  opening_counts: DemoCount[];
  final_deposit_cents: number | null;
  updated_at: string;
};

const PREFIX = "pny-demo-draft:v1:";

export function signDemoDrafts(drafts: DemoDraft[], secret: string) {
  const packed = gzipSync(Buffer.from(JSON.stringify(drafts))).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${PREFIX}${packed}`).digest("base64url");
  return `v1.${packed}.${sig}`;
}

export function readDemoDrafts(token: string, secret: string): DemoDraft[] {
  if (!token || !secret) return [];
  const versionEnd = token.indexOf(".");
  const sigStart = token.lastIndexOf(".");
  if (versionEnd <= 0 || sigStart <= versionEnd) return [];
  const version = token.slice(0, versionEnd);
  const packed = token.slice(versionEnd + 1, sigStart);
  const sig = token.slice(sigStart + 1);
  if (version !== "v1" || !packed || !sig) return [];
  const expected = createHmac("sha256", secret).update(`${PREFIX}${packed}`).digest("base64url");
  if (!safeEqual(sig, expected)) return [];
  try {
    const parsed = JSON.parse(gunzipSync(Buffer.from(packed, "base64url")).toString("utf8")) as DemoDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.shift_id === "string");
  } catch {
    return [];
  }
}

export function chunkToken(token: string, size = 3000) {
  const parts: string[] = [];
  for (let index = 0; index < token.length; index += size) parts.push(token.slice(index, index + size));
  return parts.length ? parts : [""];
}
