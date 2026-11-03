import { assertSecret, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const service = await getService();
    return json(await service.endShiftFromSccx({
      key: idempotencyKey(request, body),
      store: String(body.store ?? ""),
      shift_id: String(body.shift_id ?? ""),
      reason: body.reason == null ? undefined : String(body.reason),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
