import { clientIp, json, readBody, SESSION_COOKIE, setSession, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const result = await service.login(String(body.pin ?? ""), clientIp(request));
    await setSession(SESSION_COOKIE, result.token);
    return json({ ok: true, staff_name: result.staff_name, pos_id: result.pos_id });
  } catch (error) {
    return toResponse(error);
  }
}
