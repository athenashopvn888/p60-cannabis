import { beginDemoRequest, endDemoRequest, json, loadDemoJournal, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const service = await getService();
    await beginDemoRequest(service);
    if (service.bootstrap().demo) await service.absorbForDemo(await loadDemoJournal());
    try {
      const body = await readBody(request);
      return json(await service.submitClosingCount(await staffToken(), {
        confirm_blanks_zero: body.confirm_blanks_zero === true,
      }));
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
