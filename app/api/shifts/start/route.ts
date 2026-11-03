import { assertSecret, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const service = await getService();
    return json(await service.startShift({
      key: idempotencyKey(request, body),
      store: String(body.store ?? ""),
      staff_ref: String(body.staff_ref ?? ""),
      pos_id: body.pos_id == null ? undefined : String(body.pos_id),
      shift_id: String(body.shift_id ?? ""),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
