import { assertSecret, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    assertSecret(request.headers.get("x-roster-secret"), loadSecrets().roster);
    const service = await getService();
    return json(await service.upsertRoster({
      key: idempotencyKey(request, body),
      event_id: body.event_id == null ? undefined : String(body.event_id),
      staff_uid: String(body.staff_uid ?? ""),
      sccx_id: body.sccx_id == null ? undefined : String(body.sccx_id),
      pos_id: body.pos_id == null ? undefined : String(body.pos_id),
      display_name: body.display_name == null ? undefined : String(body.display_name),
      active: body.active == null ? undefined : Boolean(body.active),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
