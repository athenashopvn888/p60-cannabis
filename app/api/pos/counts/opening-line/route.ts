import { json, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.saveOpeningCount(await staffToken(), {
      sku: String(body.sku ?? ""),
      counted_qty: Number(body.counted_qty),
      variance_reason: body.variance_reason == null ? undefined : String(body.variance_reason),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
