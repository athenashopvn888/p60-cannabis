import { beginDemoRequest, endDemoRequest, json, loadDemoJournal, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    await beginDemoRequest(service);
    if (service.bootstrap().demo) await service.absorbForDemo(await loadDemoJournal());
    try {
      return json(await service.jumpOpeningCount(await staffToken(), String(body.sku ?? "")));
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
