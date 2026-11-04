import { assertSecret, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sets the open shift's verify clock to now. Nothing else on the shift changes. */
export async function POST(request: Request) {
  try {
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const body = await readBody(request);
    const service = await getService();
    return json(await service.restartVerifyDeadline(String(body.shift_id ?? "")));
  } catch (error) {
    return toResponse(error);
  }
}
