import { adminToken, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const decision = body.decision === "REJECT" ? "REJECT" : "CONFIRM";
    return json(await service.linkAdjustment(await adminToken(), {
      key: idempotencyKey(request, body),
      kitchen_row_id: String(body.kitchen_row_id ?? ""),
      ledger_id: String(body.ledger_id ?? ""),
      decision,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
