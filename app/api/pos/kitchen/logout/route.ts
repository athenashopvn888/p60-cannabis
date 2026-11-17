import { clearSession, json, KITCHEN_COOKIE } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";

export async function POST() {
  await clearSession(KITCHEN_COOKIE);
  return json({ ok: true });
}
