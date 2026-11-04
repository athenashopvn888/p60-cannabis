import { beginDemoRequest, endDemoRequest, json, loadDemoJournal, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const service = await getService();
    await beginDemoRequest(service);
    if (service.bootstrap().demo) await service.absorbForDemo(await loadDemoJournal());
    try {
      return json(await service.submitVerifyCount(await staffToken()));
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
