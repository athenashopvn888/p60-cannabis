import { clearSession, json, KITCHEN_COOKIE, kitchenToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await kitchenToken();
    const service = await getService();
    await service.logout(token);
    await clearSession(KITCHEN_COOKIE);
    return json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
