import { idempotencyKey, json, readBody, refillLines, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    return json(await (await getService()).requestStock(await staffToken(), {
      key: idempotencyKey(request, body),
      lines: refillLines(body),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
