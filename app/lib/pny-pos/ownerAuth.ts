import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { safeEqual } from "./crypto.ts";

const COOKIE = "pny_owner_session";
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 14 * 60 * 60 * 1000;

type FailState = { fails: number; lockedUntil: number };
const failsByIp = new Map<string, FailState>();

export const OWNER_COOKIE = COOKIE;

export function ownerPasswordHash() {
  return process.env.OWNER_PASSWORD_HASH?.trim() ?? "";
}

export function ownerSessionSecret() {
  return process.env.OWNER_SESSION_SECRET?.trim() ?? "";
}

export function ownerAuthConfigured() {
  return Boolean(ownerPasswordHash() && ownerSessionSecret());
}

function verifyScrypt(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const got = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hash, "hex");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

export function lockoutStatus(ip: string, nowMs = Date.now()) {
  const row = failsByIp.get(ip);
  if (!row) return { locked: false as const, fails: 0, remainingMs: 0 };
  if (row.lockedUntil > nowMs) return { locked: true as const, fails: row.fails, remainingMs: row.lockedUntil - nowMs };
  if (row.fails >= MAX_FAILS && row.lockedUntil <= nowMs) {
    failsByIp.delete(ip);
    return { locked: false as const, fails: 0, remainingMs: 0 };
  }
  return { locked: false as const, fails: row.fails, remainingMs: 0 };
}

export function recordOwnerFail(ip: string, nowMs = Date.now()) {
  const current = failsByIp.get(ip) ?? { fails: 0, lockedUntil: 0 };
  const fails = current.fails + 1;
  const lockedUntil = fails >= MAX_FAILS ? nowMs + LOCK_MS : 0;
  failsByIp.set(ip, { fails, lockedUntil });
  return { fails, locked: lockedUntil > nowMs, remainingMs: Math.max(0, lockedUntil - nowMs) };
}

export function clearOwnerFails(ip: string) {
  failsByIp.delete(ip);
}

export function checkOwnerPassword(password: string) {
  const stored = ownerPasswordHash();
  if (!stored) return false;
  return verifyScrypt(password, stored);
}

export function signOwnerSession(nowMs = Date.now()) {
  const secret = ownerSessionSecret();
  if (!secret) throw new Error("OWNER_SESSION_SECRET is not configured.");
  const body = Buffer.from(JSON.stringify({ v: 1, role: "owner", store: "PNY01", exp: Math.floor((nowMs + SESSION_MS) / 1000), n: randomBytes(8).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

export function readOwnerSession(token: string, nowMs = Date.now()) {
  const secret = ownerSessionSecret();
  if (!secret || !token) return null;
  const [version, body, sig] = token.split(".");
  if (version !== "v1" || !body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { v: number; role: string; store: string; exp: number };
    if (ticket.v !== 1 || ticket.role !== "owner" || ticket.store !== "PNY01") return null;
    if (ticket.exp * 1000 <= nowMs) return null;
    return ticket;
  } catch {
    return null;
  }
}
