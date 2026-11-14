import { adminToken, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const rowIds = Array.isArray(body.row_ids) ? body.row_ids.map(String) : [];
    const service = await getService();
    return json(await service.retryOutboxFailures(await adminToken(), rowIds));
  } catch (error) {
    return toResponse(error);
  }
}
