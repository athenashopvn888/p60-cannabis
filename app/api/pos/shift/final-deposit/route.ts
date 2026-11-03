import { json, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.saveFinalDeposit(await staffToken(), { amount_cents: Number(body.amount_cents) }));
  } catch (error) {
    return toResponse(error);
  }
}
