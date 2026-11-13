import { beginDemoRequest, endDemoRequest, json, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.weed_in_store !== "boolean") return json({ error: "Pick YES or NO.", code: "BAD_WEED_ANSWER" }, 400);
    const service = await getService();
    await beginDemoRequest(service);
    try {
      return json(await service.answerWeedInStore(await staffToken(), body.weed_in_store));
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
