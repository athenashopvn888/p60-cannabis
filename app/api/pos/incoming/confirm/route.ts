import { idempotencyKey, json, readBody, receiptLines, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.confirmIncoming(await staffToken(), { key: idempotencyKey(request, body), lines: receiptLines(body) }));
  } catch (error) {
    return toResponse(error);
  }
}
