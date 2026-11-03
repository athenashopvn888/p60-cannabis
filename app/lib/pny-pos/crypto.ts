import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function randomPin() {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const got = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hash, "hex");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export type StaffTicket = {
  v: 1;
  store: string;
  shift: string;
  staff: string;
  exp: number;
  demo: true;
};

/** Stateless till session. Any demo instance can check it without shared memory. */
export function signStaffSession(ticket: StaffTicket, secret: string) {
  if (!secret) throw new Error("Session secret is not configured.");
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

export function readStaffSession(token: string, secret: string, nowMs: number): StaffTicket | null {
  if (!secret) return null;
  const [version, body, sig] = token.split(".");
  if (version !== "v1" || !body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StaffTicket;
    if (ticket.v !== 1 || ticket.demo !== true || !ticket.shift || !ticket.exp) return null;
    if (ticket.exp * 1000 <= nowMs) return null;
    return ticket;
  } catch {
    return null;
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function keyFromSecret(secret: string) {
  return createHash("sha256").update(`pny-pos:v1:${secret}`).digest();
}

export function encryptJson(value: unknown, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${body.toString("base64url")}`;
}

export function decryptJson<T>(payload: string, secret: string): T {
  const [version, iv, tag, body] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Encrypted payload is unreadable.");
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}
