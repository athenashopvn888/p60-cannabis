import { ADMIN_COOKIE, json, readBody, setSession, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const result = await service.adminLogin(String(body.password ?? ""));
    await setSession(ADMIN_COOKIE, result.token);
    return json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
