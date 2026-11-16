import { json, kitchenToken, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.kitchenAdjust(await kitchenToken(), {
      sku: String(body.sku ?? ""),
      delta: Number(body.delta),
      reason: String(body.reason ?? ""),
      note: typeof body.note === "string" ? body.note : "",
      confirm: body.confirm === true,
      confirm_large: body.confirm_large === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
