import { countLines, idempotencyKey, json, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const deposit = body.final_deposit_cents == null || body.final_deposit_cents === "" ? undefined : Number(body.final_deposit_cents);
    return json(await service.endShiftFromPos(await staffToken(), { key: idempotencyKey(request, body), lines: countLines(body), final_deposit_cents: deposit }));
  } catch (error) {
    return toResponse(error);
  }
}
