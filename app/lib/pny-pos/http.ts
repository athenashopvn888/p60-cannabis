import { cookies } from "next/headers";
import { safeEqual } from "./crypto.ts";
import { chunkToken, readDemoDrafts, signDemoDrafts, type DemoDraft } from "./demoDraft.ts";
import { readDemoJournal, signDemoJournal, upsertDemoOrder, type DemoJournalOrder } from "./demoJournal.ts";
import { PosError, SheetUnavailable } from "./errors.ts";
import { getService, loadSecrets } from "./runtime.ts";
import { currentStore } from "./storeContext.ts";

export const SESSION_COOKIE = "pny_pos_session";
export const KITCHEN_COOKIE = "pny_kitchen_session";
export const MANAGER_COOKIE = "pny_manager_session";
export const ADMIN_COOKIE = "pny_pos_admin";
export const DEMO_JOURNAL_COOKIE = "pny_pos_demo";
export const DEMO_DRAFT_COOKIE = "pny_pos_draft";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function toResponse(error: unknown) {
  if (error instanceof PosError) {
    return Response.json({ ok: false, error: error.message, code: error.code, ...error.details }, { status: error.status, headers: { "cache-control": "no-store" } });
  }
  if (error instanceof SheetUnavailable) {
    return Response.json(
      { ok: false, error: "The inventory sheet is busy. Try again in a moment.", code: error.code },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  console.error(error);
  return Response.json({ ok: false, error: "Unexpected error." }, { status: 500, headers: { "cache-control": "no-store" } });
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PosError(400, "BAD_BODY", "JSON object expected.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PosError(400, "BAD_BODY", "JSON object expected.");
  return parsed as Record<string, unknown>;
}

export function lineItems(body: Record<string, unknown>) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  return lines.map((line) => {
    const row = (line ?? {}) as Record<string, unknown>;
    return {
      sku: String(row.sku ?? ""),
      qty: Number(row.qty),
      unit_price_cents: row.unit_price_cents == null ? undefined : Number(row.unit_price_cents),
    };
  });
}

export function countLines(body: Record<string, unknown>) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  return lines.map((line) => {
    const row = (line ?? {}) as Record<string, unknown>;
    return {
      sku: String(row.sku ?? ""),
      counted_qty: Number(row.counted_qty),
      variance_reason: row.variance_reason == null ? undefined : String(row.variance_reason),
    };
  });
}

export function refillLines(body: Record<string, unknown>) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  return lines.map((line) => {
    const row = (line ?? {}) as Record<string, unknown>;
    return { sku: String(row.sku ?? ""), qty: Number(row.qty) };
  });
}

export function receiptLines(body: Record<string, unknown>) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  return lines.map((line) => {
    const row = (line ?? {}) as Record<string, unknown>;
    return {
      kitchen_row_id: String(row.kitchen_row_id ?? ""),
      qty_received: Number(row.qty_received),
      variance_reason: row.variance_reason == null ? undefined : String(row.variance_reason),
    };
  });
}

export function idempotencyKey(request: Request, body: Record<string, unknown>) {
  const header = request.headers.get("idempotency-key")?.trim() ?? "";
  const fromBody = typeof body.request_id === "string" ? body.request_id.trim() : typeof body.event_id === "string" ? body.event_id.trim() : "";
  if (header && fromBody && header !== fromBody) throw new PosError(400, "IDEMPOTENCY_MISMATCH", "Idempotency-Key does not match request_id.");
  return header || fromBody;
}

export function assertSecret(header: string | null, expected: string) {
  if (!expected) throw new PosError(503, "NOT_CONFIGURED", "This endpoint is not configured.");
  if (!header || !safeEqual(header, expected)) throw new PosError(401, "UNAUTHORIZED", "Unauthorized.");
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function staffToken() {
  return (await cookies()).get(currentStore().sessionCookie)?.value ?? "";
}

export async function kitchenToken() {
  return (await cookies()).get(KITCHEN_COOKIE)?.value ?? "";
}

export async function managerToken() {
  return (await cookies()).get(MANAGER_COOKIE)?.value ?? "";
}

export async function adminToken() {
  return (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
}

export async function setSession(name: string, token: string) {
  (await cookies()).set(name, token, { ...cookieBase, maxAge: 60 * 60 * 14 });
}

export async function clearSession(name: string) {
  (await cookies()).set(name, "", { ...cookieBase, maxAge: 0 });
}

function demoJournalCookie() {
  return currentStore().code === "PNY01" ? DEMO_JOURNAL_COOKIE : "pny2_pos_demo";
}

function demoDraftCookie() {
  return currentStore().code === "PNY01" ? DEMO_DRAFT_COOKIE : "pny2_pos_draft";
}

export async function loadDemoJournal(): Promise<DemoJournalOrder[]> {
  const raw = (await cookies()).get(demoJournalCookie())?.value ?? "";
  return readDemoJournal(raw, loadSecrets().session);
}

export async function saveDemoJournal(orders: DemoJournalOrder[]) {
  if (!loadSecrets().session) return;
  const value = signDemoJournal(orders, loadSecrets().session);
  (await cookies()).set(demoJournalCookie(), value, { ...cookieBase, maxAge: 60 * 60 * 14 });
}

const DRAFT_PARTS = 8;

export async function loadDemoDrafts(): Promise<DemoDraft[]> {
  const jar = await cookies();
  const name = demoDraftCookie();
  const count = Number(jar.get(name)?.value ?? "0");
  if (!Number.isInteger(count) || count <= 0) return [];
  let token = "";
  for (let index = 0; index < count && index < DRAFT_PARTS; index += 1) token += jar.get(`${name}_${index}`)?.value ?? "";
  return readDemoDrafts(token, loadSecrets().session);
}

export async function saveDemoDrafts(drafts: DemoDraft[]) {
  const secret = loadSecrets().session;
  if (!secret) return;
  const parts = chunkToken(signDemoDrafts(drafts, secret));
  const jar = await cookies();
  const draftCookie = demoDraftCookie();
  jar.set(draftCookie, String(parts.length), { ...cookieBase, maxAge: 60 * 60 * 14 });
  for (let index = 0; index < DRAFT_PARTS; index += 1) {
    const name = `${draftCookie}_${index}`;
    if (index < parts.length) jar.set(name, parts[index] ?? "", { ...cookieBase, maxAge: 60 * 60 * 14 });
    else jar.set(name, "", { ...cookieBase, maxAge: 0 });
  }
}

export async function beginDemoRequest(service: { bootstrap: () => { demo: boolean }; restoreDemoDrafts: (drafts: DemoDraft[]) => Promise<void> }) {
  if (!service.bootstrap().demo) return;
  await service.restoreDemoDrafts(await loadDemoDrafts());
}

export async function endDemoRequest(service: { bootstrap: () => { demo: boolean }; exportDemoDrafts: () => Promise<DemoDraft[]> }) {
  if (!service.bootstrap().demo) return;
  await saveDemoDrafts(await service.exportDemoDrafts());
}

export async function rememberDemoOrder(demo: boolean, orders: DemoJournalOrder[], order: DemoJournalOrder | null | undefined) {
  if (!demo || !order) return orders;
  const next = upsertDemoOrder(orders, order);
  await saveDemoJournal(next);
  return next;
}

export async function cronOk(request: Request) {
  const secrets = loadSecrets();
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-cron-secret");
  assertSecret(bearer || alt, secrets.cron);
  return getService();
}
