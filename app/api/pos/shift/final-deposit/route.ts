import { beginDemoRequest, endDemoRequest, json, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    await beginDemoRequest(service);
    try {
      const float = body.float_cents == null || body.float_cents === "" ? undefined : Number(body.float_cents);
      return json(await service.saveFinalDeposit(await staffToken(), { amount_cents: Number(body.amount_cents), float_cents: float }));
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
