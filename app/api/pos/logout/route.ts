import { clearSession, json, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { currentStore } from "@/app/lib/pny-pos/storeContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await staffToken();
    const service = await getService();
    await service.logout(token);
    await clearSession(currentStore().sessionCookie);
    return json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
