import { adminToken, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.setPrice(await adminToken(), {
      sku: String(body.sku ?? ""),
      price_override_cents: body.price_override_cents === null ? null : body.price_override_cents == null ? undefined : Number(body.price_override_cents),
      enabled: body.enabled == null ? undefined : Boolean(body.enabled),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
