import { adminToken, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.voidSale(await adminToken(), {
      key: idempotencyKey(request, body),
      sale_id: String(body.sale_id ?? ""),
      reason: String(body.reason ?? ""),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
