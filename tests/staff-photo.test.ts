import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  availablePrompts,
  detectImageKind,
  expiryFor,
  loginAllowed,
  mimeMatchesKind,
  operationalDayContext,
  MEDIA_RETRY_WINDOW_MS,
  SHOT_PROMPTS,
} from "../app/lib/staffPhotoCore.ts";
import { dailyPin, verifyDailyPin } from "../app/lib/staffPhotoPin.ts";
import { signStaffSession, validateStaffSession } from "../app/lib/staffPhotoSessionToken.ts";

const secret = "test-secret-that-is-at-least-thirty-two-characters-long";

test("operational date rotates at 06:00 Toronto time", () => {
  const before = operationalDayContext(new Date("2026-07-23T09:59:59Z"), 6);
  const after = operationalDayContext(new Date("2026-07-23T10:00:00Z"), 6);
  assert.equal(before.dayKey, "2026-07-22");
  assert.equal(after.dayKey, "2026-07-23");
  assert.equal(after.validFrom.toISOString(), "2026-07-23T10:00:00.000Z");
  assert.equal(after.validUntil.toISOString(), "2026-07-24T10:00:00.000Z");
});

test("06:00 boundary remains correct across Toronto DST changes", () => {
  const spring = operationalDayContext(new Date("2026-03-08T10:00:00Z"), 6);
  const fall = operationalDayContext(new Date("2026-11-01T11:00:00Z"), 6);
  assert.equal(spring.dayKey, "2026-03-08");
  assert.equal(spring.validFrom.toISOString(), "2026-03-08T10:00:00.000Z");
  assert.equal(fall.dayKey, "2026-11-01");
  assert.equal(fall.validFrom.toISOString(), "2026-11-01T11:00:00.000Z");
});

test("daily PIN is deterministic and separated by store, day and version", () => {
  const pin = dailyPin(secret, "PNY01", "2026-07-23", 1);
  assert.match(pin, /^\d{4}$/);
  assert.equal(pin, dailyPin(secret, "PNY01", "2026-07-23", 1));
  assert.notEqual(pin, dailyPin(secret, "NMG01", "2026-07-23", 1));
  assert.notEqual(pin, dailyPin(secret, "PNY01", "2026-07-22", 1));
  assert.notEqual(pin, dailyPin(secret, "PNY01", "2026-07-23", 2));
});

test("consecutive operational days never reuse the prior PIN", () => {
  let previous = "";
  const start = Date.parse("2026-01-01T12:00:00Z");
  for (let day = 0; day < 370; day += 1) {
    const key = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
    const pin = dailyPin(secret, "PNY01", key, 1);
    if (previous) assert.notEqual(pin, previous);
    previous = pin;
  }
});

test("previous PIN is rejected by default and optional grace is bounded", () => {
  process.env.PNY_STAFF_DAILY_PIN_SECRET = secret;
  process.env.PNY_STAFF_PIN_BOUNDARY_HOUR = "6";
  process.env.PNY_STAFF_PREVIOUS_PIN_GRACE_MINUTES = "0";
  const prior = dailyPin(secret, "PNY01", "2026-07-22", 1);
  assert.equal(verifyDailyPin(prior, 1, new Date("2026-07-23T10:00:01Z")), false);
  process.env.PNY_STAFF_PREVIOUS_PIN_GRACE_MINUTES = "15";
  assert.equal(verifyDailyPin(prior, 1, new Date("2026-07-23T10:05:00Z")), true);
  assert.equal(verifyDailyPin(prior, 1, new Date("2026-07-23T10:16:00Z")), false);
  process.env.PNY_STAFF_PREVIOUS_PIN_GRACE_MINUTES = "0";
});

test("emergency version rotation invalidates the old PIN", () => {
  process.env.PNY_STAFF_DAILY_PIN_SECRET = secret;
  const now = new Date("2026-07-23T14:00:00Z");
  const oldPin = dailyPin(secret, "PNY01", "2026-07-23", 7);
  assert.equal(verifyDailyPin(oldPin, 7, now), true);
  assert.equal(verifyDailyPin(oldPin, 8, now), false);
});

test("consecutive emergency versions never reuse the prior PIN", () => {
  let previous = "";
  for (let version = 1; version <= 20; version += 1) {
    const pin = dailyPin(secret, "PNY01", "2026-07-23", version);
    if (previous) assert.notEqual(pin, previous);
    previous = pin;
  }
});

test("sessions are version and operational-day bound", () => {
  const beforeBoundary = Date.parse("2026-07-23T09:55:00Z");
  const token = signStaffSession(secret, 7, beforeBoundary, 6);
  assert.equal(validateStaffSession(token, secret, 7, beforeBoundary, 6), true);
  assert.equal(validateStaffSession(token, secret, 8, beforeBoundary, 6), false);
  assert.equal(validateStaffSession(token, secret, 7, Date.parse("2026-07-23T10:00:00Z"), 6), false);
});

test("used prompts are removed and reset by the caller's weekly set", () => {
  const available = availablePrompts([SHOT_PROMPTS[0].key, SHOT_PROMPTS[2].key]);
  assert.equal(available.length, SHOT_PROMPTS.length - 2);
  assert.equal(available.some((item) => item.key === SHOT_PROMPTS[0].key), false);
  assert.equal(availablePrompts([]).length, SHOT_PROMPTS.length);
});

test("magic bytes must agree with MIME", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectImageKind(jpeg), "jpeg");
  assert.equal(mimeMatchesKind("image/jpeg", detectImageKind(jpeg)), true);
  assert.equal(mimeMatchesKind("image/png", detectImageKind(jpeg)), false);
  assert.equal(detectImageKind(png), "png");
  assert.equal(detectImageKind(Uint8Array.from([1, 2, 3])), null);
});

test("media expires after the full following operational day", () => {
  const early = new Date("2026-07-14T10:01:00Z");
  const late = new Date("2026-07-15T09:59:00Z");
  const expected = new Date("2026-07-16T10:00:00Z");
  assert.equal(expiryFor(early).toISOString(), expected.toISOString());
  assert.equal(expiryFor(late).toISOString(), expected.toISOString());
  assert.equal(
    expiryFor(early).getTime() - operationalDayContext(early).validUntil.getTime(),
    MEDIA_RETRY_WINDOW_MS,
  );
});

test("rate limit blocks the seventh failed attempt in a 15 minute window", () => {
  assert.equal(loginAllowed(5), true);
  assert.equal(loginAllowed(6), false);
});

test("client source does not contain server secret names or PIN formula", () => {
  const client = readFileSync(new URL("../app/staff-photo/StaffPhotoApp.tsx", import.meta.url), "utf8");
  assert.equal(client.includes("PNY_STAFF_"), false);
  assert.equal(client.includes("createHmac"), false);
  assert.equal(client.includes("DAILY_PIN_SECRET"), false);
});

test("deployment cleanup is scheduled and keeps separate cron authorization", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [
    { path: "/api/staff-photo/maintenance/cleanup?window=edt", schedule: "15 10 * * *" },
    { path: "/api/staff-photo/maintenance/cleanup?window=est", schedule: "15 11 * * *" },
  ]);
  const route = readFileSync(new URL("../app/api/staff-photo/maintenance/cleanup/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function GET/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /PNY_STAFF_CLEANUP_TOKEN/);
});

test("private Vercel Blob state uses fresh reads and optimistic concurrency", () => {
  const store = readFileSync(new URL("../app/lib/staffPhotoStore.ts", import.meta.url), "utf8");
  assert.match(store, /STAFF_STATE_PATH = "staff-photo\/state\/v1\.json"/);
  assert.match(store, /access: "private"/);
  assert.match(store, /useCache: false/);
  assert.match(store, /BlobPreconditionFailedError/);
  assert.match(store, /ifMatch: etag/);
  assert.doesNotMatch(store, /NEXT_PUBLIC_/);
});

test("staff-photo runtime and package have no Supabase dependency", () => {
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const runtimeFiles = [
    "../app/lib/staffPhotoAuth.ts",
    "../app/lib/staffPhotoStore.ts",
    "../app/api/staff-photo/auth/route.ts",
    "../app/api/staff-photo/status/route.ts",
    "../app/api/staff-photo/submissions/route.ts",
    "../app/api/staff-photo/issues/route.ts",
    "../app/api/staff-photo/random-check/route.ts",
    "../app/api/staff-photo/collector/status/route.ts",
    "../app/api/staff-photo/collector/media/[id]/route.ts",
    "../app/api/staff-photo/collector/ack/route.ts",
    "../app/api/staff-photo/collector/credentials/route.ts",
    "../app/api/staff-photo/collector/credentials/rotate/route.ts",
    "../app/api/staff-photo/maintenance/cleanup/route.ts",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.match(packageJson, /"@vercel\/blob"/);
  assert.doesNotMatch(packageJson, /@supabase/);
  assert.doesNotMatch(runtimeFiles, /supabase/i);
});

test("collector streams private media without browser caching or Blob URL exposure", () => {
  const route = readFileSync(new URL("../app/api/staff-photo/collector/media/[id]/route.ts", import.meta.url), "utf8");
  assert.match(route, /getStaffMedia/);
  assert.match(route, /"cache-control": "private, no-store"/);
  assert.match(route, /"x-content-type-options": "nosniff"/);
  assert.doesNotMatch(route, /\\.url/);
});
