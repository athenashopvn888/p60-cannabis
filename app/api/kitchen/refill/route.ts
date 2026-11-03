import { idempotencyKey, json, readBody, refillLines, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const kind = body.kind === "ALLOCATION" ? "ALLOCATION" : "REFILL";
    const service = await getService();
    return json(await service.sendRefill(await staffToken(), {
      key: idempotencyKey(request, body),
      kind,
      lines: refillLines(body),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
