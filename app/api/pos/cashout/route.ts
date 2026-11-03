import { idempotencyKey, json, lineItems, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.cashout(await staffToken(), {
      key: idempotencyKey(request, body),
      lines: lineItems(body),
      ticket_id: body.ticket_id == null ? null : String(body.ticket_id),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
