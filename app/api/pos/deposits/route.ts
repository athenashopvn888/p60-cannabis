import { idempotencyKey, json, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.deposit(await staffToken(), {
      key: idempotencyKey(request, body),
      amount_cents: Number(body.amount_cents),
      note: body.note == null ? undefined : String(body.note),
      confirm_near_duplicate: body.confirm_near_duplicate === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
