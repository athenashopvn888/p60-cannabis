import { KITCHEN_COOKIE, clearSession, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearSession(KITCHEN_COOKIE);
    return json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
