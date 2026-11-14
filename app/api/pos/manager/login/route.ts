import { clientIp, json, MANAGER_COOKIE, readBody, setSession, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const result = await (await getService()).managerLogin(String(body.pin ?? ""), clientIp(request));
    await setSession(MANAGER_COOKIE, result.token);
    return json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
