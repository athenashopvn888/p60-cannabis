import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { staffDb } from "./staffPhotoDb";
import { pinWindow } from "./staffPhotoPin";
import { signStaffSession, validateStaffSession } from "./staffPhotoSessionToken";

const COOKIE_NAME = "pny_staff_session";

function equalText(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function sessionSecret() {
  const value = process.env.PNY_STAFF_SESSION_SECRET || "";
  if (value.length < 32) throw new Error("Staff session secret is not configured.");
  return value;
}

export function createSessionToken(pinVersion: number, now = Date.now()) {
  return signStaffSession(sessionSecret(), pinVersion, now, Number(process.env.PNY_STAFF_PIN_BOUNDARY_HOUR || "6"));
}

export function verifySessionToken(token: string, expectedVersion: number, now = Date.now()) {
  return validateStaffSession(token, sessionSecret(), expectedVersion, now, Number(process.env.PNY_STAFF_PIN_BOUNDARY_HOUR || "6"));
}

export async function hasStaffSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value || "";
  try {
    const { data, error } = await staffDb().from("staff_photo_settings").select("pin_version").eq("id", true).single();
    if (error || !data) return false;
    return verifySessionToken(token, data.pin_version);
  } catch { return false; }
}

export async function setStaffSession(pinVersion: number) {
  const maxAge = Math.max(1, Math.floor((pinWindow().validUntil.getTime() - Date.now()) / 1000));
  (await cookies()).set(COOKIE_NAME, createSessionToken(pinVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
    path: "/",
    priority: "high",
  });
}

export async function clearStaffSession() {
  (await cookies()).set(COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
}

export function verifyBearer(request: Request, expected: string | undefined) {
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(expected && expected.length >= 32 && equalText(supplied, expected));
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return Boolean(host && originUrl.host === host);
  } catch { return false; }
}
