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
      return json(await service.saveOpeningFloat(await staffToken(), { found_cents: Number(body.found_cents) }));
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
